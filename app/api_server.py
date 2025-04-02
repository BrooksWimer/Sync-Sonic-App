#!/usr/bin/env python3
import subprocess
import time
import re
import queue
import threading
import json
from flask import Flask, jsonify, request
from pydbus import SystemBus

app = Flask(__name__)

# Add color constants at the top of the file after imports
HEADER = '\033[95m'
BLUE = '\033[94m'
GREEN = '\033[92m'
YELLOW = '\033[93m'
RED = '\033[91m'
ENDC = '\033[0m'
BOLD = '\033[1m'
UNDERLINE = '\033[4m'

# Global scanning state and discovered devices
device_queue = queue.Queue()
scanning = False
seen_devices = {}
scan_process = None

def log(msg):
    print(f"{time.strftime('%Y-%m-%d %H:%M:%S')} - {msg}")

def get_managed_objects(bus):
    manager = bus.get("org.bluez", "/")
    return manager.GetManagedObjects()

def get_adapter_by_address(bus, adapter_address, objects):
    for path, ifaces in objects.items():
        adapter = ifaces.get("org.bluez.Adapter1")
        if adapter and "Address" in adapter and adapter["Address"].upper() == adapter_address.upper():
            return path, bus.get("org.bluez", path)
    return None, None

def get_device_by_address(bus, adapter_path, device_address, objects):
    for path, ifaces in objects.items():
        if not path.startswith(adapter_path):
            continue
        device = ifaces.get("org.bluez.Device1")
        if device and "Address" in device and device["Address"].upper() == device_address.upper():
            return path, bus.get("org.bluez", path)
    return None, None

def disconnect_device(bus, adapter_addr, device_addr):
    objects = get_managed_objects(bus)
    adapter_path, adapter_obj = get_adapter_by_address(bus, adapter_addr, objects)
    if not adapter_obj:
        log(f"Adapter {adapter_addr} not found.")
        return False
    dev_path, device_obj = get_device_by_address(bus, adapter_path, device_addr, objects)
    if not device_obj:
        log(f"Device {device_addr} not found under adapter {adapter_addr}.")
        return False
    try:
        log(f"Disconnecting device {device_addr} from adapter {adapter_addr}...")
        device_obj.Disconnect()
        time.sleep(2)
        return True
    except Exception as e:
        log(f"Error disconnecting {device_addr} on {adapter_addr}: {e}")
        return False

def pair_and_connect(bus, adapter_addr, device_addr):
    objects = get_managed_objects(bus)
    adapter_path, adapter_obj = get_adapter_by_address(bus, adapter_addr, objects)
    if not adapter_obj:
        log(f"Adapter {adapter_addr} not found.")
        return False
    dev_path, device_obj = get_device_by_address(bus, adapter_path, device_addr, objects)
    if not device_obj:
        log(f"Device {device_addr} not found under adapter {adapter_addr}.")
        return False
    try:
        log(f"Starting discovery on adapter {adapter_addr}...")
        adapter_obj.StartDiscovery()
        time.sleep(5)
        adapter_obj.StopDiscovery()
        max_wait = 5
        start = time.time()
        while adapter_obj.Discovering and (time.time() - start < max_wait):
            log(f"Waiting for adapter {adapter_addr} to stop discovering...")
            time.sleep(1)
    except Exception as e:
        log(f"Discovery error on adapter {adapter_addr}: {e}")
    try:
        if not device_obj.Paired:
            log(f"Pairing device {device_addr} on adapter {adapter_addr}...")
            device_obj.Pair()
            time.sleep(5)
        else:
            log(f"Device {device_addr} already paired.")
    except Exception as e:
        log(f"Pairing error for device {device_addr} on adapter {adapter_addr}: {e}")
        return False
    try:
        device_obj.Trusted = True
        log(f"Device {device_addr} set as Trusted.")
    except Exception as e:
        log(f"Error setting Trusted for device {device_addr}: {e}")
    try:
        log(f"Connecting device {device_addr} on adapter {adapter_addr}...")
        device_obj.Connect()
        time.sleep(3)
    except Exception as e:
        log(f"Connection error for device {device_addr} on adapter {adapter_addr}: {e}")
        return False
    objects = get_managed_objects(bus)
    dev_path, device_obj = get_device_by_address(bus, adapter_path, device_addr, objects)
    if device_obj and device_obj.Connected:
        log(f"Device {device_addr} successfully connected on adapter {adapter_addr}.")
        return True
    else:
        log(f"Device {device_addr} did not appear as connected on adapter {adapter_addr}.")
        return False

def connect_only(bus, adapter_addr, device_addr):
    objects = get_managed_objects(bus)
    adapter_path, adapter_obj = get_adapter_by_address(bus, adapter_addr, objects)
    if not adapter_obj:
        log(f"Adapter {adapter_addr} not found.")
        return False
    dev_path, device_obj = get_device_by_address(bus, adapter_path, device_addr, objects)
    if not device_obj:
        log(f"Device {device_addr} not found under adapter {adapter_addr}.")
        return False
    try:
        log(f"Starting discovery on adapter {adapter_addr}...")
        adapter_obj.StartDiscovery()
        time.sleep(5)
        adapter_obj.StopDiscovery()
        max_wait = 5
        start = time.time()
        while adapter_obj.Discovering and (time.time() - start < max_wait):
            log(f"Waiting for adapter {adapter_addr} to stop discovering...")
            time.sleep(1)
    except Exception as e:
        log(f"Discovery error on adapter {adapter_addr}: {e}")
    try:
        log(f"Connecting device {device_addr} on adapter {adapter_addr}...")
        device_obj.Connect()
        time.sleep(3)
    except Exception as e:
        log(f"Connection error for device {device_addr} on adapter {adapter_addr}: {e}")
        return False
    objects = get_managed_objects(bus)
    dev_path, device_obj = get_device_by_address(bus, adapter_path, device_addr, objects)
    if device_obj and device_obj.Connected:
        log(f"Device {device_addr} successfully connected on adapter {adapter_addr}.")
        return True
    else:
        log(f"Device {device_addr} did not appear as connected on adapter {adapter_addr}. Retrying...")
        time.sleep(3)
        try:
            device_obj.Connect()
            time.sleep(3)
        except Exception as e:
            log(f"Retry connection error for device {device_addr} on adapter {adapter_addr}: {e}")
            return False
        objects = get_managed_objects(bus)
        dev_path, device_obj = get_device_by_address(bus, adapter_path, device_addr, objects)
        if device_obj and device_obj.Connected:
            log(f"Device {device_addr} successfully connected on adapter {adapter_addr} after retry.")
            return True
        else:
            log(f"Device {device_addr} still did not appear as connected on adapter {adapter_addr}.")
            return False

def setup_pulseaudio():
    try:
        # Start PulseAudio if not running
        subprocess.run(["pulseaudio", "--start"], check=True)
        time.sleep(2)

        # Create virtual sink
        virtual_sink = subprocess.run(
            ["pactl", "load-module", "module-null-sink", "sink_name=virtual_out", "sink_properties=device.description=virtual_out"],
            capture_output=True,
            text=True
        ).stdout.strip()
        log(f"Virtual sink created with index: {virtual_sink}")

        # Wait for PulseAudio to be ready
        max_attempts = 10
        for attempt in range(max_attempts):
            try:
                subprocess.run(["pactl", "list", "sinks", "short"], check=True)
                break
            except subprocess.CalledProcessError:
                if attempt == max_attempts - 1:
                    raise Exception("PulseAudio did not initialize properly")
                time.sleep(1)

        return True
    except Exception as e:
        log(f"Error setting up PulseAudio: {e}")
        return False

def create_loopback(sink_name):
    try:
        loopback = subprocess.run(
            ["pactl", "load-module", "module-loopback", "source=virtual_out.monitor", f"sink={sink_name}", "latency_msec=100"],
            capture_output=True,
            text=True
        ).stdout.strip()
        log(f"Loopback for {sink_name} loaded with index: {loopback}")
        return True
    except Exception as e:
        log(f"Error creating loopback for {sink_name}: {e}")
        return False

def cleanup_pulseaudio():
    try:
        log(f"{YELLOW}Cleaning up PulseAudio sinks and loopbacks...{ENDC}")
        
        # First, get all modules and their properties
        log(f"{BLUE}Fetching module list...{ENDC}")
        modules_output = subprocess.run(["pactl", "list", "modules"], capture_output=True, text=True)
        if modules_output.returncode != 0:
            log(f"{RED}Error getting module list: {modules_output.stderr}{ENDC}")
            return False
            
        log(f"{BLUE}Parsing module information...{ENDC}")
        current_module = None
        module_properties = {}
        
        for line in modules_output.stdout.splitlines():
            if line.startswith("Module #"):
                if current_module:
                    module_properties[current_module] = current_properties
                current_module = line.split()[1]
                current_properties = {}
                log(f"{GREEN}Found module {current_module}{ENDC}")
            elif line.strip() and current_module and ":" in line:
                key, value = line.split(":", 1)
                current_properties[key.strip()] = value.strip()
                log(f"{BLUE}  Property: {key.strip()} = {value.strip()}{ENDC}")
        
        if current_module:
            module_properties[current_module] = current_properties
        
        # Get all sinks
        log(f"{BLUE}Fetching sink list...{ENDC}")
        sinks_output = subprocess.run(["pactl", "list", "sinks", "short"], capture_output=True, text=True)
        if sinks_output.returncode != 0:
            log(f"{RED}Error getting sink list: {sinks_output.stderr}{ENDC}")
            return False
            
        for line in sinks_output.stdout.splitlines():
            if "virtual_out" in line or "bluez_sink" in line:
                sink_name = line.split()[1]
                log(f"{YELLOW}Found sink to remove: {sink_name}{ENDC}")
                
                # Find the module that created this sink
                found_module = False
                for module_id, properties in module_properties.items():
                    if "sink_name" in properties and properties["sink_name"] == sink_name:
                        log(f"{GREEN}Found module {module_id} for sink {sink_name}{ENDC}")
                        unload_result = subprocess.run(["pactl", "unload-module", module_id], capture_output=True, text=True)
                        if unload_result.returncode != 0:
                            log(f"{RED}Error unloading module {module_id}: {unload_result.stderr}{ENDC}")
                        else:
                            log(f"{GREEN}Successfully unloaded module {module_id}{ENDC}")
                        found_module = True
                        break
                
                if not found_module:
                    log(f"{RED}No module found for sink {sink_name}{ENDC}")
        
        # Get all loopback modules
        log(f"{BLUE}Processing loopback modules...{ENDC}")
        for module_id, properties in module_properties.items():
            if "name" in properties and "module-loopback" in properties["name"]:
                log(f"{YELLOW}Found loopback module {module_id}{ENDC}")
                unload_result = subprocess.run(["pactl", "unload-module", module_id], capture_output=True, text=True)
                if unload_result.returncode != 0:
                    log(f"{RED}Error unloading loopback module {module_id}: {unload_result.stderr}{ENDC}")
                else:
                    log(f"{GREEN}Successfully unloaded loopback module {module_id}{ENDC}")
        
        # Verify cleanup
        log(f"{BLUE}Verifying cleanup...{ENDC}")
        verify_sinks = subprocess.run(["pactl", "list", "sinks", "short"], capture_output=True, text=True)
        verify_modules = subprocess.run(["pactl", "list", "modules", "short"], capture_output=True, text=True)
        
        remaining_sinks = [line for line in verify_sinks.stdout.splitlines() if "virtual_out" in line or "bluez_sink" in line]
        remaining_loopbacks = [line for line in verify_modules.stdout.splitlines() if "module-loopback" in line]
        
        if remaining_sinks:
            log(f"{RED}Warning: Remaining sinks found: {remaining_sinks}{ENDC}")
        if remaining_loopbacks:
            log(f"{RED}Warning: Remaining loopback modules found: {remaining_loopbacks}{ENDC}")
        
        log(f"{GREEN}PulseAudio cleanup completed{ENDC}")
        return True
    except Exception as e:
        log(f"{RED}Error during PulseAudio cleanup: {str(e)}{ENDC}")
        log(f"{RED}Error type: {type(e).__name__}{ENDC}")
        import traceback
        log(f"{RED}Traceback: {traceback.format_exc()}{ENDC}")
        return False

@app.route("/start-scan")
def start_scan():
    global scanning, scan_process
    if scanning:
        return jsonify({"message": "Already scanning."}), 200
    scanning = True
    threading.Thread(target=scan_devices_background, daemon=True).start()
    return jsonify({"message": "Scan started."}), 200


@app.route("/stop-scan")
def stop_scan():
    global scanning, scan_process
    scanning = False
    try:
        if scan_process and scan_process.stdin:
            scan_process.stdin.write("scan off\n")
            scan_process.stdin.flush()
            time.sleep(1)
            scan_process.kill()
            scan_process = None
            print("DEBUG: Scan stopped and bluetoothctl process killed.")
    except Exception as e:
        print("Error in /stop-scan:", e)
        return jsonify({"error": str(e)}), 500

    return jsonify({"message": "Scanning stopped."})




@app.route("/device-queue")
def device_queue_api():
    global seen_devices
    while not device_queue.empty():
        mac, name = device_queue.get()
        seen_devices[mac] = name
    return jsonify(seen_devices)





def scan_devices_background():
    global scanning, scan_process
    print("DEBUG: scan_devices_background thread started")

    scan_process = subprocess.Popen(
        ["bluetoothctl"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,  # <- Combine stderr so we can catch errors
        universal_newlines=True
    )
    scan_process.stdin.write("power on\n")
    scan_process.stdin.write("agent on\n")
    scan_process.stdin.write("default-agent\n")
    scan_process.stdin.write("scan on\n")
    scan_process.stdin.flush()
    print("DEBUG: Sent 'scan on' to bluetoothctl")

    try:
        while scanning:
            line = scan_process.stdout.readline()
            print(f"DEBUG: bluetoothctl output: {line.strip()}")  # Always print
            if "NEW" in line:
                parts = line.strip().split()
                if len(parts) >= 4:
                    mac = parts[2]
                    display_name = " ".join(parts[3:])
                    if re.search(r'([0-9A-F]{2}-){2,}', display_name, re.IGNORECASE):
                        print(f"DEBUG: Filtering out device: {display_name}")
                    else:
                        device_queue.put((mac, display_name))
                        print(f"DEBUG: Adding device: {mac} with name: {display_name}")
    except Exception as e:
        print("Scan error:", e)
    finally:
        scanning = False
        if scan_process and scan_process.stdin:
            scan_process.stdin.write("scan off\n")
            scan_process.stdin.flush()
        if scan_process:
            scan_process.kill()
            scan_process = None




@app.route("/pair", methods=["POST"])
def api_pair():
    data = request.get_json()
    if not data or "devices" not in data:
        return jsonify({"error": "Missing 'devices' field in JSON body"}), 400
    config_id = data.get("configID", "defaultID")
    config_name = data.get("configName", "defaultName")
    devices = data["devices"]
    settings = data.get("settings", {})
    try:
        cmd = [
            "./connect_configuration.sh",
            str(config_id),
            config_name,
            json.dumps(devices),
            json.dumps(settings)
        ]
        subprocess.run(cmd, check=True)
        return jsonify({"message": "Pairing process completed successfully."})
    except subprocess.CalledProcessError as e:
        return jsonify({"error": str(e)}), 500

@app.route("/volume", methods=["POST"])
def api_volume():
    data = request.get_json()
    if not data or "mac" not in data or "volume" not in data:
        return jsonify({"error": "Missing 'mac' or 'volume' field"}), 400
    mac = data["mac"]
    volume = data["volume"]
    
    try:
        # First, check if the device is connected
        log(f"{BLUE}Checking connection status for device {mac}...{ENDC}")
        bus = SystemBus()
        objects = get_managed_objects(bus)
        
        # Find the device in the managed objects
        device_found = False
        device_connected = False
        for path, ifaces in objects.items():
            if "org.bluez.Device1" in ifaces:
                device = ifaces["org.bluez.Device1"]
                if device.get("Address", "").upper() == mac.upper():
                    device_found = True
                    device_connected = device.get("Connected", False)
                    log(f"{GREEN}Found device {mac} in BlueZ{ENDC}")
                    log(f"{YELLOW}Connection status: {'Connected' if device_connected else 'Disconnected'}{ENDC}")
                    break
        
        if not device_found:
            log(f"{RED}Device {mac} not found in BlueZ{ENDC}")
            return jsonify({"error": f"Device {mac} not found"}), 500
            
        if not device_connected:
            log(f"{RED}Device {mac} is not connected{ENDC}")
            return jsonify({"error": f"Device {mac} is not connected"}), 500
            
        # Get all sinks to find the correct sink name
        log(f"{BLUE}Fetching sink list...{ENDC}")
        sinks_output = subprocess.run(["pactl", "list", "sinks", "short"], capture_output=True, text=True)
        if sinks_output.returncode != 0:
            log(f"{RED}Error getting sink list: {sinks_output.stderr}{ENDC}")
            return jsonify({"error": "Failed to get sink list"}), 500
            
        # Try different sink name formats
        sink_name = None
        mac_formatted = mac.replace(':', '_')
        
        for line in sinks_output.stdout.splitlines():
            if mac_formatted in line:
                sink_name = line.split()[1]
                break
                
        if not sink_name:
            log(f"{YELLOW}No sink found for device {mac}, checking for alternative audio profiles...{ENDC}")
            # Try to get more detailed sink information
            sinks_detail = subprocess.run(["pactl", "list", "sinks"], capture_output=True, text=True)
            if sinks_detail.returncode == 0:
                log(f"{BLUE}Full sink list:{ENDC}")
                log(sinks_detail.stdout)
                
            # Try to get device information from bluetoothctl
            device_info = subprocess.run(
                ["bluetoothctl", "info", mac],
                capture_output=True,
                text=True
            )
            if device_info.returncode == 0:
                log(f"{BLUE}Device information:{ENDC}")
                log(device_info.stdout)
                
            log(f"{RED}No sink found for device {mac}. Device might be using a different audio profile.{ENDC}")
            return jsonify({"error": f"No sink found for device {mac}. Device might be using a different audio profile."}), 500
            
        log(f"{GREEN}Found sink {sink_name} for device {mac}{ENDC}")
        
        # Set the volume
        volume_result = subprocess.run(["pactl", "set-sink-volume", sink_name, f"{volume}%"], capture_output=True, text=True)
        if volume_result.returncode != 0:
            log(f"{RED}Error setting volume: {volume_result.stderr}{ENDC}")
            return jsonify({"error": f"Failed to set volume: {volume_result.stderr}"}), 500
            
        log(f"{GREEN}Successfully set volume for {mac} to {volume}%{ENDC}")
        return jsonify({"message": f"Volume for {mac} set to {volume}%."})
        
    except Exception as e:
        log(f"{RED}Error in volume endpoint: {str(e)}{ENDC}")
        import traceback
        log(f"{RED}Traceback: {traceback.format_exc()}{ENDC}")
        return jsonify({"error": str(e)}), 500

@app.route("/latency", methods=["POST"])
def api_latency():
    data = request.get_json()
    if not data or "mac" not in data or "latency" not in data:
        return jsonify({"error": "Missing 'mac' or 'latency' field"}), 400
    mac = data["mac"]
    latency = data["latency"]
    try:
        subprocess.run(["./set_latency.sh", mac, str(latency)], check=True)
        return jsonify({"message": f"Latency for {mac} set to {latency} ms."})
    except subprocess.CalledProcessError as e:
        return jsonify({"error": str(e)}), 500


@app.route("/connect", methods=["POST"])
def api_connect():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing JSON data"}), 400
    required_fields = ["configID", "configName", "speakers", "settings"]
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing field: {field}"}), 400

    config_id = data["configID"]
    config_name = data["configName"]
    speakers = data["speakers"]
    settings = data["settings"]

    try:
        # Initialize BlueZ D-Bus connection
        bus = SystemBus()
        connection_status = {}
        changes_made = []  # Track all changes made

        # Clean up existing PulseAudio configuration
        if not cleanup_pulseaudio():
            log(f"{RED}Failed to clean up PulseAudio configuration{ENDC}")
            return jsonify({"error": "Failed to clean up PulseAudio configuration"}), 500

        # Get current Bluetooth state
        log(f"{HEADER}Current Bluetooth State:{ENDC}")
        log(f"{HEADER}======================={ENDC}")
        objects = get_managed_objects(bus)
        controllers = []
        for path, ifaces in objects.items():
            if "org.bluez.Adapter1" in ifaces:
                controllers.append(ifaces["org.bluez.Adapter1"]["Address"])
                log(f"{BLUE}Controller: {ifaces['org.bluez.Adapter1']['Address']}{ENDC}")

        # Build nested dictionaries for each controller
        nested_paired = {}  # Key: "controller:device" -> device name
        nested_connected = {}  # Key: "controller:device" -> device name

        # For each controller, get paired and connected devices
        for ctrl in controllers:
            log(f"{BLUE}----------------------------------------{ENDC}")
            log(f"{BLUE}Controller: {ctrl}{ENDC}")
            
            # Get paired devices
            log(f"{GREEN}Paired Devices:{ENDC}")
            proc = subprocess.Popen(
                ["bluetoothctl"],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                universal_newlines=True
            )
            proc.stdin.write(f"select {ctrl}\n")
            proc.stdin.write("devices Paired\n")
            proc.stdin.write("exit\n")
            proc.stdin.flush()
            paired_output, _ = proc.communicate(timeout=3)
            log(f"{YELLOW}DEBUG - Raw paired devices output:{ENDC}")
            log(paired_output)
            
            # Parse paired devices from bluetoothctl output
            for line in paired_output.splitlines():
                if line.startswith("Device"):
                    parts = line.split()
                    if len(parts) >= 3:
                        mac = parts[1]
                        name = " ".join(parts[2:])
                        nested_paired[f"{ctrl}:{mac}"] = name
                        log(f"  - {name} ({mac})")

            # Get connected devices
            log(f"{GREEN}Connected Devices:{ENDC}")
            proc = subprocess.Popen(
                ["bluetoothctl"],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                universal_newlines=True
            )
            proc.stdin.write(f"select {ctrl}\n")
            proc.stdin.write("devices Connected\n")
            proc.stdin.write("exit\n")
            proc.stdin.flush()
            connected_output, _ = proc.communicate(timeout=3)
            log(f"{YELLOW}DEBUG - Raw connected devices output:{ENDC}")
            log(connected_output)
            
            # Parse connected devices from bluetoothctl output
            for line in connected_output.splitlines():
                if line.startswith("Device"):
                    parts = line.split()
                    if len(parts) >= 3:
                        mac = parts[1]
                        name = " ".join(parts[2:])
                        nested_connected[f"{ctrl}:{mac}"] = name
                        log(f"  - {name} ({mac})")
        log(f"{HEADER}======================={ENDC}")

        # Generate and display gameplan
        log(f"{HEADER}Generated Gameplan:{ENDC}")
        log(f"{HEADER}=================={ENDC}")
        for mac, name in speakers.items():
            # Find where this speaker is currently connected
            current_controller = None
            for ctrl in controllers:
                if f"{ctrl}:{mac}" in nested_connected:
                    current_controller = ctrl
                    break

            # Find where this speaker is paired
            paired_controllers = []
            for ctrl in controllers:
                if f"{ctrl}:{mac}" in nested_paired:
                    paired_controllers.append(ctrl)

            # Determine action and planned changes
            action = ""
            planned_changes = []
            if current_controller:
                action = f"Already connected on controller {current_controller}"
                planned_changes.append("No changes needed - already connected")
            elif paired_controllers:
                action = f"Paired on controllers: {', '.join(paired_controllers)}"
                planned_changes.append("Will connect to first available paired controller")
            else:
                action = "Not paired on any controller"
                planned_changes.append("Will pair and connect to first available controller")

            log(f"{BOLD}Speaker: {name} ({mac}){ENDC}")
            log(f"{YELLOW}  Current State: {action}{ENDC}")
            log(f"{GREEN}  Planned Changes:{ENDC}")
            for change in planned_changes:
                log(f"    - {change}")
        log(f"{HEADER}=================={ENDC}")

        # Track which controllers are assigned
        assigned_controllers = {}

        # Process each speaker
        for mac, name in speakers.items():
            log(f"{BOLD}Processing {name} ({mac}){ENDC}")
            
            # Find where this speaker is currently connected
            current_controller = None
            for ctrl in controllers:
                if f"{ctrl}:{mac}" in nested_connected:
                    current_controller = ctrl
                    break

            # Find where this speaker is paired
            paired_controllers = []
            for ctrl in controllers:
                if f"{ctrl}:{mac}" in nested_paired:
                    paired_controllers.append(ctrl)

            # Determine action
            if current_controller:
                if current_controller not in assigned_controllers:
                    # Speaker is connected to a free controller
                    assigned_controllers[current_controller] = mac
                    connection_status[mac] = {"name": name, "result": "Connected"}
                    changes_made.append(f"Kept {name} connected to controller {current_controller}")
                    continue

            # Find a free controller that this speaker is paired on
            free_paired_controller = None
            for ctrl in paired_controllers:
                if ctrl not in assigned_controllers:
                    free_paired_controller = ctrl
                    break

            if free_paired_controller:
                # Speaker is paired on a free controller
                assigned_controllers[free_paired_controller] = mac
                # Disconnect from current controller if needed
                if current_controller:
                    disconnect_device(bus, current_controller, mac)
                    changes_made.append(f"Disconnected {name} from controller {current_controller}")
                # Connect to the free paired controller
                result = connect_only(bus, free_paired_controller, mac)
                if result:
                    connection_status[mac] = {"name": name, "result": "Connected"}
                    changes_made.append(f"Connected {name} to controller {free_paired_controller}")
                else:
                    connection_status[mac] = {"name": name, "result": "Error in Connect Only"}
                    changes_made.append(f"{RED}Failed to connect {name} to controller {free_paired_controller}{ENDC}")
                continue

            # Find any free controller
            free_controller = None
            for ctrl in controllers:
                if ctrl not in assigned_controllers:
                    free_controller = ctrl
                    break

            if not free_controller:
                connection_status[mac] = {"name": name, "result": "Error: No free controller"}
                changes_made.append(f"{RED}No free controller available for {name}{ENDC}")
                continue

            # Disconnect from current controller if needed
            if current_controller:
                disconnect_device(bus, current_controller, mac)
                changes_made.append(f"Disconnected {name} from controller {current_controller}")

            # Try to pair and connect to free controller
            result = pair_and_connect(bus, free_controller, mac)
            if result:
                assigned_controllers[free_controller] = mac
                connection_status[mac] = {"name": name, "result": "Connected"}
                changes_made.append(f"Paired and connected {name} to controller {free_controller}")
            else:
                connection_status[mac] = {"name": name, "result": "Error in Pair and Connect"}
                changes_made.append(f"{RED}Failed to pair and connect {name} to controller {free_controller}{ENDC}")

        # Set up PulseAudio for connected speakers
        if not setup_pulseaudio():
            log(f"{RED}Failed to set up PulseAudio{ENDC}")
            return jsonify({"error": "Failed to set up PulseAudio"}), 500

        # Create loopbacks for connected speakers
        for mac, status in connection_status.items():
            if status["result"] == "Connected":
                sink_name = f"bluez_sink.{mac.replace(':', '_')}.a2dp_sink"
                if create_loopback(sink_name):
                    changes_made.append(f"Created loopback for {status['name']}")
                else:
                    changes_made.append(f"{RED}Failed to create loopback for {status['name']}{ENDC}")

        # Unsuspend all sinks
        sinks = subprocess.run(["pactl", "list", "sinks", "short"], capture_output=True, text=True).stdout
        for line in sinks.splitlines():
            sink_name = line.split()[1]
            subprocess.run(["pactl", "suspend-sink", sink_name, "0"])

        # Unload module-suspend-on-idle
        modules = subprocess.run(["pactl", "list", "modules", "short"], capture_output=True, text=True).stdout
        for line in modules.splitlines():
            if "module-suspend-on-idle" in line:
                module_id = line.split()[0]
                subprocess.run(["pactl", "unload-module", module_id])

        # Print summary of changes
        log(f"{HEADER}Summary of Changes:{ENDC}")
        log(f"{HEADER}=================={ENDC}")
        for change in changes_made:
            log(change)
        log(f"{HEADER}=================={ENDC}")

        return jsonify(connection_status)

    except Exception as e:
        log(f"{RED}Error in connection process: {e}{ENDC}")
        return jsonify({"error": str(e)}), 500





@app.route("/disconnect", methods=["POST"])
def api_disconnect():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing JSON data"}), 400
    required_fields = ["configID", "configName", "speakers", "settings"]
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing field: {field}"}), 400

    config_id = data["configID"]
    config_name = data["configName"]
    speakers = data["speakers"]
    settings = data["settings"]

    try:
        cmd = [
            "./disconnect_configuration.sh",
            str(config_id),
            config_name,
            json.dumps(speakers),
            json.dumps(settings)
        ]
        subprocess.run(cmd, check=True)
        return jsonify({"message": "Configuration disconnected successfully."})
    except subprocess.CalledProcessError as e:
        return jsonify({"error": str(e)}), 500


@app.route("/paired-devices", methods=["GET"])
def api_paired_devices():
    try:
        devices = {}

        # Step 1: Get list of all Bluetooth controllers
        list_output = subprocess.check_output(
            ["bluetoothctl", "list"],
            universal_newlines=True
        )

        controller_macs = []
        for line in list_output.splitlines():
            if line.startswith("Controller"):
                parts = line.strip().split()
                if len(parts) >= 2:
                    controller_macs.append(parts[1])  # e.g., BC:FC:E7:21:1A:0B

        # Step 2: For each controller, list paired devices
        for ctrl_mac in controller_macs:
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

            for line in output.splitlines():
                if line.startswith("Device"):
                    parts = line.split()
                    if len(parts) >= 3:
                        mac = parts[1]
                        display_name = " ".join(parts[2:]).strip()
                        devices[mac] = display_name

        return jsonify(devices)

    except subprocess.CalledProcessError as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500





if __name__ == '__main__':
    app.run(host="0.0.0.0", port=3000)
