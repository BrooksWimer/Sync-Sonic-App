#!/usr/bin/env python3

import dbus
import dbus.exceptions
import dbus.mainloop.glib
import dbus.service
import array
import sys
import os
import threading
import logging
from gi.repository import GLib
import json
import subprocess
import queue
import re
import time

# Set up logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

BLUEZ_SERVICE_NAME = 'org.bluez'
GATT_MANAGER_IFACE = 'org.bluez.GattManager1'
LE_ADVERTISING_MANAGER_IFACE = 'org.bluez.LEAdvertisingManager1'
DBUS_OM_IFACE = 'org.freedesktop.DBus.ObjectManager'
DBUS_PROP_IFACE = 'org.freedesktop.DBus.Properties'
GATT_SERVICE_IFACE = 'org.bluez.GattService1'
GATT_CHRC_IFACE = 'org.bluez.GattCharacteristic1'
AGENT_INTERFACE = 'org.bluez.Agent1'
AGENT_MANAGER_INTERFACE = 'org.bluez.AgentManager1'
ADAPTER_INTERFACE = 'org.bluez.Adapter1'
DEVICE_INTERFACE = 'org.bluez.Device1'
AGENT_PATH = '/org/bluez/example/agent'

# Message types
MESSAGE_TYPES = {
    "PING": 0x01,
    "PONG": 0x02,
    "ERROR": 0x03,
    "START_SCAN": 0x10,
    "STOP_SCAN": 0x11,
    "GET_DEVICES": 0x12,
    "DEVICE_FOUND": 0x13,
    "PAIR": 0x20,
    "SET_VOLUME": 0x30,
    "SET_LATENCY": 0x31,
    "CONNECT": 0x40,
    "DISCONNECT": 0x41,
    "GET_PAIRED_DEVICES": 0x50,
    "SUCCESS": 0xF0,
    "FAILURE": 0xF1
}

# UUIDs from specification
SERVICE_UUID = '19b10000-e8f2-537e-4f6c-d104768a1214'
CHARACTERISTIC_UUID = '19b10001-e8f2-537e-4f6c-d104768a1217'

mainloop = None
device_queue = queue.Queue()
scanning = False
seen_devices = {}
scan_process = None

def find_adapter(bus, preferred_adapter=None):
    """
    Find and return the first available Bluetooth adapter or a specific one if preferred_adapter is set.

    Args:
        bus: The D-Bus system bus
        preferred_adapter: Optional name of preferred adapter (e.g., 'hci0')

    Returns:
        Tuple of (adapter_path, adapter_interface) or (None, None) if no adapter found
    """
    remote_om = dbus.Interface(bus.get_object(BLUEZ_SERVICE_NAME, '/'), DBUS_OM_IFACE)
    objects = remote_om.GetManagedObjects()

    for path, interfaces in objects.items():
        if ADAPTER_INTERFACE not in interfaces:
            continue

        if preferred_adapter:
            adapter_name = path.split('/')[-1]
            if adapter_name == preferred_adapter:
                adapter = dbus.Interface(bus.get_object(BLUEZ_SERVICE_NAME, path), ADAPTER_INTERFACE)
                return path, adapter
        else:
            adapter = dbus.Interface(bus.get_object(BLUEZ_SERVICE_NAME, path), ADAPTER_INTERFACE)
            return path, adapter

    return None, None

def reset_adapter(adapter):
    """
    Reset the Bluetooth adapter to a clean state.
    """
    try:
        # Get the adapter properties interface
        adapter_props = dbus.Interface(
            bus.get_object(BLUEZ_SERVICE_NAME, adapter.object_path),
            DBUS_PROP_IFACE)

        # Power cycle the adapter
        adapter_props.Set(ADAPTER_INTERFACE, "Powered", dbus.Boolean(False))
        GLib.timeout_add(2000, lambda: None)  # Longer delay to ensure power down
        adapter_props.Set(ADAPTER_INTERFACE, "Powered", dbus.Boolean(True))

        # Remove all devices
        objects = dbus.Interface(bus.get_object(BLUEZ_SERVICE_NAME, '/'), DBUS_OM_IFACE).GetManagedObjects()
        for path, interfaces in objects.items():
            if 'org.bluez.Device1' in interfaces:
                device = dbus.Interface(bus.get_object(BLUEZ_SERVICE_NAME, path), 'org.bluez.Device1')
                device_props = dbus.Interface(bus.get_object(BLUEZ_SERVICE_NAME, path), DBUS_PROP_IFACE)
                try:
                    # Remove trusted status and disconnect
                    device_props.Set('org.bluez.Device1', 'Trusted', dbus.Boolean(False))
                    device.Disconnect()
                except:
                    pass
                try:
                    adapter.RemoveDevice(dbus.ObjectPath(path))
                except:
                    pass

        # Wait a bit after cleaning up devices
        GLib.timeout_add(1000, lambda: None)

        logger.info("Adapter reset successfully")
    except Exception as e:
        logger.error(f"Failed to reset adapter: {e}")

class DeviceManager:
    def __init__(self, bus, adapter_path):
        self.bus = bus
        self.adapter_path = adapter_path
        self.devices = {}
        self.reconnect_attempts = {}
        self.max_reconnect_attempts = 3
        self.pairing_in_progress = set()
        self.setup_device_monitoring()

    def setup_device_monitoring(self):
        obj = self.bus.get_object('org.freedesktop.DBus', '/org/freedesktop/DBus')
        self.bus.add_signal_receiver(
            self.interfaces_added,
            dbus_interface='org.freedesktop.DBus.ObjectManager',
            signal_name='InterfacesAdded')

        self.bus.add_signal_receiver(
            self.properties_changed,
            dbus_interface='org.freedesktop.DBus.Properties',
            signal_name='PropertiesChanged',
            path_keyword='path')

    def reset_device_state(self, path, remove_device=True):
        """Reset all state for a device"""
        self.pairing_in_progress.discard(path)
        if path in self.reconnect_attempts:
            self.reconnect_attempts[path] = 0

        if remove_device and path in self.devices:
            try:
                # Remove device from adapter
                adapter = dbus.Interface(
                    self.bus.get_object(BLUEZ_SERVICE_NAME, self.adapter_path),
                    ADAPTER_INTERFACE
                )
                adapter.RemoveDevice(dbus.ObjectPath(path))
                del self.devices[path]
                logger.info(f"Reset device state and removed device: {path}")
            except Exception as e:
                logger.error(f"Failed to remove device: {e}")
        else:
            logger.info(f"Reset device state (keeping device): {path}")

    def try_direct_connect(self, path):
        """Attempt to connect to a device without pairing"""
        if path not in self.devices:
            return False

        try:
            device_iface = self.devices[path]['iface']
            device_props = self.devices[path]['props']

            # Check if device is already connected
            try:
                if device_props.Get(DEVICE_INTERFACE, 'Connected'):
                    logger.info(f"Device {path} is already connected")
                    return True
            except:
                pass

            # Try to connect directly
            try:
                device_iface.Connect()
                logger.info(f"Direct connection successful: {path}")
                return True
            except Exception as e:
                logger.debug(f"Direct connection failed: {e}")
                return False
        except Exception as e:
            logger.error(f"Error during direct connection attempt: {e}")
            return False

    def interfaces_added(self, path, interfaces):
        if DEVICE_INTERFACE in interfaces:
            self.device_found(path)

    def properties_changed(self, interface, changed, invalidated, path):
        if interface != DEVICE_INTERFACE:
            return

        if path in self.devices:
            dev_props = self.devices[path]['props']

            # Handle pairing state changes
            if 'Paired' in changed:
                if changed['Paired']:
                    logger.info(f"Device paired successfully: {path}")
                    self.pairing_in_progress.discard(path)
                    # Schedule connection after successful pairing
                    def delayed_connect():
                        try:
                            if path in self.devices:
                                device_iface = self.devices[path]['iface']
                                device_iface.Connect()
                                logger.info(f"Connected to newly paired device: {path}")
                        except Exception as e:
                            logger.error(f"Failed to connect after pairing: {e}")
                        return False
                    GLib.timeout_add(1000, delayed_connect)
                else:
                    logger.info(f"Device unpaired: {path}")
                    # If device becomes unpaired, reset its state
                    self.reset_device_state(path)

            # Handle connection state changes
            if 'Connected' in changed:
                if not changed['Connected']:
                    logger.info(f"Device disconnected: {path}")
                    # If we're in pairing mode and get a disconnect, assume pairing failed
                    if path in self.pairing_in_progress:
                        logger.warning(f"Device disconnected during pairing, resetting state: {path}")
                        self.reset_device_state(path)
                    elif path not in self.pairing_in_progress:
                        if path not in self.reconnect_attempts:
                            self.reconnect_attempts[path] = 0
                        if self.reconnect_attempts[path] < self.max_reconnect_attempts:
                            self.try_reconnect(path)
                        else:
                            logger.warning(f"Maximum reconnection attempts reached for device: {path}")
                            self.reset_device_state(path)
                else:
                    logger.info(f"Device connected: {path}")
                    self.reconnect_attempts[path] = 0
                    # Set trusted when successfully connected
                    try:
                        dev_props.Set(DEVICE_INTERFACE, 'Trusted', dbus.Boolean(True))
                    except:
                        pass

    def device_found(self, path):
        if path in self.devices:
            return

        try:
            device = self.bus.get_object(BLUEZ_SERVICE_NAME, path)
            device_props = dbus.Interface(device, DBUS_PROP_IFACE)
            device_iface = dbus.Interface(device, DEVICE_INTERFACE)

            # Store the device
            self.devices[path] = {
                'device': device,
                'props': device_props,
                'iface': device_iface
            }

            try:
                # Set trusted and blocked properties
                device_props.Set(DEVICE_INTERFACE, 'Trusted', dbus.Boolean(True))
                device_props.Set(DEVICE_INTERFACE, 'Blocked', dbus.Boolean(False))
            except Exception as e:
                logger.debug(f"Could not set device properties: {e}")

            logger.info(f"New device registered: {path}")

            # Check if this is a remembered device
            try:
                paired = device_props.Get(DEVICE_INTERFACE, 'Paired')
                if paired:
                    logger.info(f"Found remembered device, attempting direct connection: {path}")
                    if self.try_direct_connect(path):
                        return
                    else:
                        logger.info(f"Direct connection failed, will try fresh pairing")
                        # Reset state but don't remove device yet
                        self.reset_device_state(path, remove_device=False)
            except:
                pass

        except Exception as e:
            logger.error(f"Failed to register device {path}: {e}")

    def try_reconnect(self, path):
        if path not in self.devices:
            return

        try:
            device_iface = self.devices[path]['iface']
            device_props = self.devices[path]['props']
            self.reconnect_attempts[path] += 1
            attempt = self.reconnect_attempts[path]

            def delayed_connect():
                try:
                    # For first attempt on a remembered device, try direct connection
                    if attempt == 1:
                        try:
                            paired = device_props.Get(DEVICE_INTERFACE, 'Paired')
                            if paired:
                                logger.info(f"Attempting direct connection to remembered device: {path}")
                                if self.try_direct_connect(path):
                                    return False
                        except:
                            pass

                    # Check if device is already connected
                    try:
                        if device_props.Get(DEVICE_INTERFACE, 'Connected'):
                            logger.info(f"Device {path} is already connected")
                            return False
                    except:
                        pass

                    # Check pairing state
                    try:
                        paired = device_props.Get(DEVICE_INTERFACE, 'Paired')
                        if not paired:
                            logger.info(f"Device {path} needs pairing, initiating pairing process")
                            self.pairing_in_progress.add(path)
                            device_iface.Pair()
                            return False
                    except dbus.exceptions.DBusException as e:
                        if "org.bluez.Error.AuthenticationFailed" in str(e):
                            logger.warning(f"Authentication failed for device {path}, resetting state")
                            # Now we remove the device since authentication failed
                            self.reset_device_state(path, remove_device=True)
                            return False
                        logger.debug(f"Could not check pairing state: {e}")

                    # Only attempt connection if not currently pairing
                    if path not in self.pairing_in_progress:
                        device_iface.Connect()
                        logger.info(f"Reconnected to device: {path}")
                    else:
                        logger.info(f"Skipping connection attempt while pairing is in progress: {path}")

                except dbus.exceptions.DBusException as e:
                    if "org.bluez.Error.AuthenticationFailed" in str(e):
                        logger.warning(f"Authentication failed for device {path}, resetting state")
                        self.reset_device_state(path, remove_device=True)
                    else:
                        logger.error(f"Failed to reconnect to {path} (attempt {attempt}): {e}")

                    # If this was the last attempt, clean up
                    if attempt >= self.max_reconnect_attempts:
                        logger.warning(f"Giving up on reconnecting to device: {path}")
                        self.reset_device_state(path, remove_device=True)
                return False

            # Exponential backoff for reconnection attempts
            delay = min(1000 * (2 ** (attempt - 1)), 5000)  # Cap at 5 seconds
            logger.info(f"Scheduling reconnection attempt {attempt} in {delay}ms")
            GLib.timeout_add(delay, delayed_connect)
        except Exception as e:
            logger.error(f"Error during reconnection attempt to {path}: {e}")

class Agent(dbus.service.Object):
    def __init__(self, bus):
        super().__init__(bus, AGENT_PATH)
        self.bus = bus
        self.paired_devices = set()
        logger.info("Agent initialized")

    @dbus.service.method(AGENT_INTERFACE,
                        in_signature="", out_signature="")
    def Release(self):
        logger.info("Agent released")

    @dbus.service.method(AGENT_INTERFACE,
                        in_signature="os", out_signature="")
    def AuthorizeService(self, device, uuid):
        logger.info(f"AuthorizeService: {device} {uuid}")
        # Always authorize the service
        return

    @dbus.service.method(AGENT_INTERFACE,
                        in_signature="o", out_signature="s")
    def RequestPinCode(self, device):
        logger.info(f"RequestPinCode: {device}")
        return "000000"

    @dbus.service.method(AGENT_INTERFACE,
                        in_signature="o", out_signature="u")
    def RequestPasskey(self, device):
        logger.info(f"RequestPasskey: {device}")
        return dbus.UInt32(0)

    @dbus.service.method(AGENT_INTERFACE,
                        in_signature="ouq", out_signature="")
    def DisplayPasskey(self, device, passkey, entered):
        logger.info(f"DisplayPasskey: {device} {passkey} {entered}")

    @dbus.service.method(AGENT_INTERFACE,
                        in_signature="os", out_signature="")
    def DisplayPinCode(self, device, pincode):
        logger.info(f"DisplayPinCode: {device} {pincode}")

    @dbus.service.method(AGENT_INTERFACE,
                        in_signature="ou", out_signature="")
    def RequestConfirmation(self, device, passkey):
        logger.info(f"RequestConfirmation: {device} {passkey}")
        return

    @dbus.service.method(AGENT_INTERFACE,
                        in_signature="o", out_signature="")
    def RequestAuthorization(self, device):
        logger.info(f"RequestAuthorization: {device}")
        return

class Characteristic(dbus.service.Object):
    def __init__(self, bus, index, uuid, flags, service):
        self.path = service.path + '/char' + str(index)
        self.bus = bus
        self.uuid = uuid
        self.flags = flags
        self.service = service
        self.value = [dbus.Byte(0)] * 5
        self.notifying = False
        self.connected_devices = set()
        self.device_manager = None
        self.scanning = False
        self.scan_process = None
        dbus.service.Object.__init__(self, bus, self.path)
        logger.info(f"Characteristic created with UUID: {uuid}")

    def set_device_manager(self, device_manager):
        self.device_manager = device_manager

    def get_properties(self):
        return {
            GATT_CHRC_IFACE: {
                'Service': self.service.get_path(),
                'UUID': self.uuid,
                'Flags': self.flags,
                'Value': self.value,
                'Notifying': dbus.Boolean(self.notifying)
            }
        }

    def get_path(self):
        return dbus.ObjectPath(self.path)

    def handle_device_connection(self, device_path, connected):
        if connected:
            self.connected_devices.add(device_path)
            if self.device_manager:
                self.device_manager.device_found(device_path)
            logger.info(f"Device connected: {device_path}")
        else:
            self.connected_devices.discard(device_path)
            logger.info(f"Device disconnected: {device_path}")

    @dbus.service.method(DBUS_PROP_IFACE,
                         in_signature='ss',
                         out_signature='v')
    def Get(self, interface, prop):
        if prop == "Value":
            logger.debug(f"Get value called: {self.value}")
            return dbus.Array(self.value, signature='y')
        return None

    def encode_response(self, message_type, data):
        """Encode a response message"""
        try:
            json_str = json.dumps(data)
            json_bytes = json_str.encode('utf-8')
            response = [dbus.Byte(message_type)]
            response.extend([dbus.Byte(b) for b in json_bytes])
            return response
        except Exception as e:
            logger.error(f"Error encoding response: {e}")
            return self.encode_response(MESSAGE_TYPES["ERROR"], {"error": str(e)})

    def decode_message(self, value):
        """Decode a received message"""
        try:
            message_type = value[0]
            if len(value) > 1:
                json_bytes = bytes([int(b) for b in value[1:]])
                data = json.loads(json_bytes.decode('utf-8'))
            else:
                data = {}
            return message_type, data
        except Exception as e:
            logger.error(f"Error decoding message: {e}")
            return MESSAGE_TYPES["ERROR"], {"error": str(e)}

    def handle_start_scan(self):
        """Handle START_SCAN message"""
        if self.scanning:
            return self.encode_response(MESSAGE_TYPES["SUCCESS"], {"message": "Already scanning"})

        self.scanning = True
        threading.Thread(target=self.scan_devices_background, daemon=True).start()
        return self.encode_response(MESSAGE_TYPES["SUCCESS"], {"message": "Scan started"})

    def handle_stop_scan(self):
        """Handle STOP_SCAN message"""
        self.scanning = False
        try:
            if self.scan_process and self.scan_process.stdin:
                self.scan_process.stdin.write("scan off\n")
                self.scan_process.stdin.flush()
                time.sleep(1)
                self.scan_process.kill()
                self.scan_process = None
        except Exception as e:
            logger.error(f"Error stopping scan: {e}")
            return self.encode_response(MESSAGE_TYPES["ERROR"], {"error": str(e)})
        return self.encode_response(MESSAGE_TYPES["SUCCESS"], {"message": "Scan stopped"})

    def handle_get_devices(self):
        """Handle GET_DEVICES message"""
        global seen_devices
        while not device_queue.empty():
            mac, name = device_queue.get()
            seen_devices[mac] = name
        return self.encode_response(MESSAGE_TYPES["SUCCESS"], seen_devices)

    def handle_pair(self, data):
        """Handle PAIR message"""
        try:
            if not all(key in data for key in ["configID", "configName", "devices", "settings"]):
                return self.encode_response(MESSAGE_TYPES["ERROR"], {"error": "Missing required fields"})

            cmd = [
                "./connect_configuration.sh",
                str(data["configID"]),
                data["configName"],
                json.dumps(data["devices"]),
                json.dumps(data["settings"])
            ]
            subprocess.run(cmd, check=True)
            return self.encode_response(MESSAGE_TYPES["SUCCESS"], {"message": "Pairing completed"})
        except Exception as e:
            return self.encode_response(MESSAGE_TYPES["ERROR"], {"error": str(e)})

    def handle_set_volume(self, data):
        """Handle SET_VOLUME message"""
        try:
            if "mac" not in data or "volume" not in data:
                return self.encode_response(MESSAGE_TYPES["ERROR"], {"error": "Missing mac or volume"})

            mac = data["mac"]
            volume = data["volume"]

            # Get sink name
            sinks_output = subprocess.run(["pactl", "list", "sinks", "short"],
                                        capture_output=True, text=True)

            sink_name = None
            mac_formatted = mac.replace(':', '_')

            for line in sinks_output.stdout.splitlines():
                if mac_formatted in line:
                    sink_name = line.split()[1]
                    break

            if not sink_name:
                return self.encode_response(MESSAGE_TYPES["ERROR"],
                                         {"error": f"No sink found for device {mac}"})

            # Set volume
            subprocess.run(["pactl", "set-sink-volume", sink_name, f"{volume}%"],
                         check=True)

            return self.encode_response(MESSAGE_TYPES["SUCCESS"],
                                      {"message": f"Volume set to {volume}%"})
        except Exception as e:
            return self.encode_response(MESSAGE_TYPES["ERROR"], {"error": str(e)})

    def handle_set_latency(self, data):
        """Handle SET_LATENCY message"""
        try:
            if "mac" not in data or "latency" not in data:
                return self.encode_response(MESSAGE_TYPES["ERROR"],
                                         {"error": "Missing mac or latency"})

            subprocess.run(["./set_latency.sh", data["mac"], str(data["latency"])],
                         check=True)

            return self.encode_response(MESSAGE_TYPES["SUCCESS"],
                                      {"message": f"Latency set to {data['latency']}ms"})
        except Exception as e:
            return self.encode_response(MESSAGE_TYPES["ERROR"], {"error": str(e)})

    def handle_connect(self, data):
        """Handle CONNECT message"""
        try:
            if not all(key in data for key in ["configID", "configName", "speakers", "settings"]):
                return self.encode_response(MESSAGE_TYPES["ERROR"],
                                         {"error": "Missing required fields"})

            # Initialize connection tracking
            connection_status = {}
            bus = SystemBus()

            # Clean up PulseAudio
            if not cleanup_pulseaudio():
                return self.encode_response(MESSAGE_TYPES["ERROR"],
                                         {"error": "Failed to clean up PulseAudio"})

            # Process each speaker
            for mac, name in data["speakers"].items():
                try:
                    # Find adapter and attempt connection
                    objects = get_managed_objects(bus)
                    adapter_path, adapter = find_adapter(bus, 'hci1')
                    if not adapter_path:
                        connection_status[mac] = {"name": name, "result": "No adapter found"}
                        continue

                    # Try to connect
                    if pair_and_connect(bus, adapter_path, mac):
                        connection_status[mac] = {"name": name, "result": "Connected"}
                    else:
                        connection_status[mac] = {"name": name, "result": "Connection failed"}
                except Exception as e:
                    connection_status[mac] = {"name": name, "result": f"Error: {str(e)}"}

            # Set up PulseAudio for connected speakers
            if not setup_pulseaudio():
                return self.encode_response(MESSAGE_TYPES["ERROR"],
                                         {"error": "Failed to set up PulseAudio"})

            # Create loopbacks for connected speakers
            for mac, status in connection_status.items():
                if status["result"] == "Connected":
                    sink_name = f"bluez_sink.{mac.replace(':', '_')}.a2dp_sink"
                    create_loopback(sink_name)

            return self.encode_response(MESSAGE_TYPES["SUCCESS"], connection_status)
        except Exception as e:
            return self.encode_response(MESSAGE_TYPES["ERROR"], {"error": str(e)})

    def handle_disconnect(self, data):
        """Handle DISCONNECT message"""
        try:
            if not all(key in data for key in ["configID", "configName", "speakers", "settings"]):
                return self.encode_response(MESSAGE_TYPES["ERROR"],
                                         {"error": "Missing required fields"})

            cmd = [
                "./disconnect_configuration.sh",
                str(data["configID"]),
                data["configName"],
                json.dumps(data["speakers"]),
                json.dumps(data["settings"])
            ]
            subprocess.run(cmd, check=True)
            return self.encode_response(MESSAGE_TYPES["SUCCESS"],
                                     {"message": "Disconnected successfully"})
        except Exception as e:
            return self.encode_response(MESSAGE_TYPES["ERROR"], {"error": str(e)})

    def handle_get_paired_devices(self):
        """Handle GET_PAIRED_DEVICES message"""
        try:
            devices = {}

            # Get list of controllers
            list_output = subprocess.check_output(
                ["bluetoothctl", "list"],
                universal_newlines=True
            )

            # Process each controller
            for line in list_output.splitlines():
                if line.startswith("Controller"):
                    ctrl_mac = line.strip().split()[1]

                    # Get paired devices for this controller
                    proc = subprocess.Popen(
                        ["bluetoothctl"],
                        stdin=subprocess.PIPE,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        universal_newlines=True
                    )

                    proc.stdin.write(f"select {ctrl_mac}\n")
                    proc.stdin.write("devices Paired\n")
                    proc.stdin.write("exit\n")
                    proc.stdin.flush()

                    output, _ = proc.communicate(timeout=3)

                    # Process paired devices
                    for dev_line in output.splitlines():
                        if dev_line.startswith("Device"):
                            parts = dev_line.split()
                            if len(parts) >= 3:
                                mac = parts[1]
                                name = " ".join(parts[2:]).strip()
                                devices[mac] = name

            return self.encode_response(MESSAGE_TYPES["SUCCESS"], devices)
        except Exception as e:
            return self.encode_response(MESSAGE_TYPES["ERROR"], {"error": str(e)})

    def scan_devices_background(self):
        """Background scanning process"""
        self.scan_process = subprocess.Popen(
            ["bluetoothctl"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True
        )

        self.scan_process.stdin.write("power on\n")
        self.scan_process.stdin.write("agent on\n")
        self.scan_process.stdin.write("default-agent\n")
        self.scan_process.stdin.write("scan on\n")
        self.scan_process.stdin.flush()

        try:
            while self.scanning:
                line = self.scan_process.stdout.readline()
                if "NEW" in line:
                    parts = line.strip().split()
                    if len(parts) >= 4:
                        mac = parts[2]
                        name = " ".join(parts[3:])
                        if not re.search(r'([0-9A-F]{2}-){2,}', name, re.IGNORECASE):
                            device_queue.put((mac, name))
                            # Notify connected clients about new device
                            if self.notifying:
                                response = self.encode_response(MESSAGE_TYPES["DEVICE_FOUND"],
                                                             {"mac": mac, "name": name})
                                self.value = response
                                self.PropertiesChanged(GATT_CHRC_IFACE,
                                                     {'Value': dbus.Array(self.value)}, [])
        except Exception as e:
            logger.error(f"Scan error: {e}")
        finally:
            self.scanning = False
            if self.scan_process and self.scan_process.stdin:
                self.scan_process.stdin.write("scan off\n")
                self.scan_process.stdin.flush()
            if self.scan_process:
                self.scan_process.kill()
                self.scan_process = None

    @dbus.service.method(GATT_CHRC_IFACE, in_signature='aya{sv}')
    def WriteValue(self, value, options):
        """Handle incoming messages"""
        logger.debug(f"WriteValue called with value: {value}, options: {options}")

        # Handle device connection
        device = options.get('device', None)
        if device:
            self.handle_device_connection(device, True)

        try:
            message_type, data = self.decode_message(value)

            # Handle different message types
            if message_type == MESSAGE_TYPES["PING"]:
                response = [dbus.Byte(MESSAGE_TYPES["PONG"])]
                response.extend([dbus.Byte(b) for b in data.get("count", 0).to_bytes(4, byteorder='big')])
            elif message_type == MESSAGE_TYPES["START_SCAN"]:
                response = self.handle_start_scan()
            elif message_type == MESSAGE_TYPES["STOP_SCAN"]:
                response = self.handle_stop_scan()
            elif message_type == MESSAGE_TYPES["GET_DEVICES"]:
                response = self.handle_get_devices()
            elif message_type == MESSAGE_TYPES["PAIR"]:
                response = self.handle_pair(data)
            elif message_type == MESSAGE_TYPES["SET_VOLUME"]:
                response = self.handle_set_volume(data)
            elif message_type == MESSAGE_TYPES["SET_LATENCY"]:
                response = self.handle_set_latency(data)
            elif message_type == MESSAGE_TYPES["CONNECT"]:
                response = self.handle_connect(data)
            elif message_type == MESSAGE_TYPES["DISCONNECT"]:
                response = self.handle_disconnect(data)
            elif message_type == MESSAGE_TYPES["GET_PAIRED_DEVICES"]:
                response = self.handle_get_paired_devices()
            else:
                response = self.encode_response(MESSAGE_TYPES["ERROR"],
                                             {"error": "Unknown message type"})

            # Set response and notify if needed
            self.value = response
            if device in self.connected_devices and self.notifying:
                self.PropertiesChanged(GATT_CHRC_IFACE, {'Value': dbus.Array(self.value)}, [])

        except Exception as e:
            logger.error(f"Error processing message: {e}")
            self.value = self.encode_response(MESSAGE_TYPES["ERROR"], {"error": str(e)})
            if device in self.connected_devices and self.notifying:
                self.PropertiesChanged(GATT_CHRC_IFACE, {'Value': dbus.Array(self.value)}, [])

    @dbus.service.method(GATT_CHRC_IFACE)
    def StartNotify(self):
        if self.notifying:
            return
        self.notifying = True
        logger.info("Notifications enabled")

    @dbus.service.method(GATT_CHRC_IFACE)
    def StopNotify(self):
        if not self.notifying:
            return
        self.notifying = False
        logger.info("Notifications disabled")

    @dbus.service.signal(DBUS_PROP_IFACE,
                        signature='sa{sv}as')
    def PropertiesChanged(self, interface, changed_properties, invalidated_properties):
        pass

class Advertisement(dbus.service.Object):
    PATH_BASE = '/org/bluez/example/advertisement'

    def __init__(self, bus, index, advertising_type):
        self.path = self.PATH_BASE + str(index)
        self.bus = bus
        self.ad_type = 'peripheral'  # Changed from advertising_type to always be 'peripheral'
        self.service_uuids = [SERVICE_UUID]
        self.local_name = 'Sync-Sonic'
        self.include_tx_power = True
        self.manufacturer_data = None
        self.solicit_uuids = None
        self.service_data = None
        self.discoverable = True
        self.pairing = True  # Changed to True to enable pairing
        dbus.service.Object.__init__(self, bus, self.path)
        logger.info("Advertisement created")

    def get_path(self):
        return dbus.ObjectPath(self.path)

    def get_properties(self):
        props = {
            'org.bluez.LEAdvertisement1': {
                'Type': dbus.String(self.ad_type),
                'ServiceUUIDs': dbus.Array(self.service_uuids, signature='s'),
                'LocalName': dbus.String(self.local_name),
                'IncludeTxPower': dbus.Boolean(self.include_tx_power),
                'Discoverable': dbus.Boolean(self.discoverable),
                'Pairing': dbus.Boolean(self.pairing)
            }
        }
        return props

    @dbus.service.method(DBUS_PROP_IFACE,
                         in_signature='ss',
                         out_signature='v')
    def Get(self, interface, prop):
        return self.get_properties()['org.bluez.LEAdvertisement1'][prop]

    @dbus.service.method(DBUS_PROP_IFACE,
                         in_signature='s',
                         out_signature='a{sv}')
    def GetAll(self, interface):
        return self.get_properties()['org.bluez.LEAdvertisement1']

    @dbus.service.method('org.bluez.LEAdvertisement1', in_signature='', out_signature='')
    def Release(self):
        logger.info("Advertisement released")

class Service(dbus.service.Object):
    def __init__(self, bus, index, uuid, primary):
        self.path = '/org/bluez/example/service' + str(index)
        self.bus = bus
        self.uuid = uuid
        self.primary = primary
        self.characteristics = []
        dbus.service.Object.__init__(self, bus, self.path)
        logger.info(f"Service created with UUID: {uuid}")

    def get_properties(self):
        return {
            GATT_SERVICE_IFACE: {
                'UUID': self.uuid,
                'Primary': self.primary,
                'Characteristics': dbus.Array(
                    [c.get_path() for c in self.characteristics],
                    signature='o')
            }
        }

    def get_path(self):
        return dbus.ObjectPath(self.path)

    def add_characteristic(self, characteristic):
        self.characteristics.append(characteristic)
        logger.debug(f"Added characteristic to service: {characteristic.uuid}")

class Application(dbus.service.Object):
    def __init__(self, bus):
        self.path = '/'
        self.services = []
        dbus.service.Object.__init__(self, bus, self.path)
        logger.info("Application created")

    def get_path(self):
        return dbus.ObjectPath(self.path)

    @dbus.service.method(DBUS_OM_IFACE,
                         out_signature='a{oa{sa{sv}}}')
    def GetManagedObjects(self):
        response = {}
        for service in self.services:
            response[service.get_path()] = service.get_properties()
            for chrc in service.characteristics:
                response[chrc.get_path()] = chrc.get_properties()
        return response

    def add_service(self, service):
        self.services.append(service)
        logger.debug(f"Added service to application: {service.uuid}")

def main():
    global mainloop
    global bus

    logger.info("Starting BLE server...")

    dbus.mainloop.glib.DBusGMainLoop(set_as_default=True)
    bus = dbus.SystemBus()

    # Find the Bluetooth adapter (prefer hci1)
    adapter_path, adapter = find_adapter(bus, 'hci1')
    if not adapter_path:
        logger.error("No Bluetooth adapter found")
        sys.exit(1)

    logger.info(f"Using Bluetooth adapter: {adapter_path}")

    # Create device manager
    device_manager = DeviceManager(bus, adapter_path)

    # Reset the adapter to a clean state
    reset_adapter(adapter)

    # Create and register the agent
    agent = Agent(bus)
    agent_manager = dbus.Interface(
        bus.get_object(BLUEZ_SERVICE_NAME, '/org/bluez'),
        AGENT_MANAGER_INTERFACE
    )

    try:
        agent_manager.RegisterAgent(AGENT_PATH, 'NoInputNoOutput')
        agent_manager.RequestDefaultAgent(AGENT_PATH)
        logger.info("Agent registered")
    except Exception as e:
        logger.error(f"Failed to register agent: {e}")
        sys.exit(1)

    # Set adapter properties
    adapter_props = dbus.Interface(
        bus.get_object(BLUEZ_SERVICE_NAME, adapter_path),
        DBUS_PROP_IFACE
    )

    try:
        # Make sure adapter is powered on
        adapter_props.Set(ADAPTER_INTERFACE, 'Powered', dbus.Boolean(True))

        # Configure adapter properties for pairing
        adapter_props.Set(ADAPTER_INTERFACE, 'Pairable', dbus.Boolean(True))
        adapter_props.Set(ADAPTER_INTERFACE, 'PairableTimeout', dbus.UInt32(0))
        adapter_props.Set(ADAPTER_INTERFACE, 'Discoverable', dbus.Boolean(True))
        adapter_props.Set(ADAPTER_INTERFACE, 'DiscoverableTimeout', dbus.UInt32(0))

        # Set adapter name
        adapter_props.Set(ADAPTER_INTERFACE, 'Alias', dbus.String('Sync-Sonic'))

        logger.info("Adapter properties set successfully")
    except Exception as e:
        logger.error(f"Failed to set adapter properties: {e}")
        sys.exit(1)

    # Create the GATT service and characteristic
    service = Service(bus, 0, SERVICE_UUID, True)
    char = Characteristic(bus, 0, CHARACTERISTIC_UUID, ['read', 'write', 'notify'], service)
    char.set_device_manager(device_manager)  # Set the device manager
    service.add_characteristic(char)

    # Create the GATT application
    app = Application(bus)
    app.add_service(service)

    # Register the GATT application
    service_manager = dbus.Interface(
        bus.get_object(BLUEZ_SERVICE_NAME, adapter_path),
        GATT_MANAGER_IFACE
    )

    # Register the advertisement
    ad_manager = dbus.Interface(
        bus.get_object(BLUEZ_SERVICE_NAME, adapter_path),
        LE_ADVERTISING_MANAGER_IFACE
    )
    ad = Advertisement(bus, 0, 'peripheral')

    mainloop = GLib.MainLoop()

    try:
        service_manager.RegisterApplication(app.get_path(), {},
            reply_handler=lambda: logger.info('GATT application registered'),
            error_handler=lambda e: logger.error(f'Failed to register application: {e}')
        )

        ad_manager.RegisterAdvertisement(ad.get_path(), {},
            reply_handler=lambda: logger.info('Advertisement registered'),
            error_handler=lambda e: logger.error(f'Failed to register advertisement: {e}')
        )
    except Exception as e:
        logger.error(f"Error during registration: {e}")
        sys.exit(1)

    logger.info('BLE GATT server running...')
    logger.info(f'Using adapter: {adapter_path}')
    logger.info('Device name: Sync-Sonic')
    logger.info('Service UUID: %s', SERVICE_UUID)
    logger.info('Characteristic UUID: %s', CHARACTERISTIC_UUID)
    logger.info('Pairing enabled - accepting secure connections')
    logger.info('Waiting for connections...')

    try:
        mainloop.run()
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.error(f"Server error: {e}")

if __name__ == '__main__':
    main()