// utils/ble_functions.ts
import { BleManager, Device } from 'react-native-ble-plx';
import { Buffer } from 'buffer';
import { Platform } from 'react-native';
import { SERVICE_UUID, CHARACTERISTIC_UUID, MESSAGE_TYPES } from './ble_constants';

// Add Buffer polyfill for React Native
if (Platform.OS !== 'web') {
  global.Buffer = Buffer;
}

const manager = new BleManager();

// Helper function to decode BLE messages
function decodeMessage(value: any): { messageType: number; data: any } | null {
  if (!value) return null;
  
  try {
    const buffer = Buffer.from(value, 'base64');
    const messageType = buffer[0];
    const jsonBytes = buffer.slice(1);
    const data = JSON.parse(jsonBytes.toString('utf8'));
    
    return {
      messageType,
      data
    };
  } catch (error) {
    console.error('Error decoding message:', error);
    return null;
  }
}

/*
 * ────────────────────────────────────────────────────
 *  UUIDs (must match the Pi backend)
 * ────────────────────────────────────────────────────
 */
export const BLE_DEVICE_NAME = 'SyncSonic';

const VOLUME_UUID     = 'd8282b50-274e-4e5e-9b5c-e6c2cddd0001';
const CONNECT_UUID    = 'd8282b50-274e-4e5e-9b5c-e6c2cddd0002';
const DISCONNECT_UUID = 'd8282b50-274e-4e5e-9b5c-e6c2cddd0003';
const MUTE_UUID       = 'd8282b50-274e-4e5e-9b5c-e6c2cddd0004';

/*
 * ────────────────────────────────────────────────────
 *  Cache the single BLE connection while music plays
 * ────────────────────────────────────────────────────
 */
let connectedDevice: Device | null = null;



/*
 * ────────────────────────────────────────────────────
 *  Generic write helper
 * ────────────────────────────────────────────────────
 */
export async function bleWrite(
  device: Device,
  messageType: number,
  payload: Record<string, any> = {}
): Promise<void> {
  try {
    // Convert payload to JSON string
    const jsonString = JSON.stringify(payload);
    console.log('=== BLE Write Debug ===');
    console.log('Message Type (opcode):', messageType.toString(16), 'hex:', '0x' + messageType.toString(16).padStart(2, '0'));
    console.log('JSON Payload:', jsonString);

    // Create a buffer for the complete message
    // First byte is the message type, followed by the JSON string bytes
    const jsonBytes = Buffer.from(jsonString, 'utf8');
    const messageBuffer = Buffer.alloc(1 + jsonBytes.length); // 1 byte for opcode + json length

    // Write the message type (opcode) as the first byte
    messageBuffer.writeUInt8(messageType, 0);
    
    // Copy the JSON bytes after the opcode
    jsonBytes.copy(messageBuffer, 1);

    // Convert to base64 for BLE transmission
    const base64Data = messageBuffer.toString('base64');
    
    // Debug logs
    console.log('Raw message buffer:', messageBuffer);
    console.log('Buffer as hex:', messageBuffer.toString('hex'));
    console.log('Buffer as array:', Array.from(messageBuffer));
    console.log('Base64 encoded message:', base64Data);
    console.log('First byte (opcode) in hex:', '0x' + messageBuffer[0].toString(16).padStart(2, '0'));
    console.log('=== End BLE Write Debug ===');

    // Get the service and characteristic
    const services = await device.services();
    console.log('Found services:', services.map(s => s.uuid));
    
    const service = services.find(s => s.uuid.toLowerCase() === SERVICE_UUID.toLowerCase());
    if (!service) {
      console.error('Service not found. Looking for:', SERVICE_UUID);
      throw new Error('GATT service not found');
    }

    const chars = await service.characteristics();
    console.log('Found characteristics:', chars.map(c => c.uuid));
    
    const char = chars.find(c => c.uuid.toLowerCase() === CHARACTERISTIC_UUID.toLowerCase());
    if (!char) {
      console.error('Characteristic not found. Looking for:', CHARACTERISTIC_UUID);
      throw new Error('Characteristic not found');
    }

    // Write the data
    console.log('Writing to characteristic:', char.uuid);
    await char.writeWithoutResponse(base64Data);
    console.log('Write operation completed');
  } catch (error) {
    console.error('Error in bleWrite:', error);
    throw error;
  }
}
  

/*
 * ────────────────────────────────────────────────────
 *  Nicely-typed wrapper helpers
 * ────────────────────────────────────────────────────
 */

export async function bleConnectOne(
    device: Device,
    mac: string,
    name: string,
    settings: Record<string, any>,
    allowedMacs: string[] = []
  ): Promise<void> {
    const payload = {
      targetSpeaker: { mac, name },
      settings: { [mac]: settings },
      allowed: allowedMacs
    };
    
    console.log('CONNECT_ONE opcode:', MESSAGE_TYPES.CONNECT_ONE.toString(16));
    console.log('Connecting speaker with payload:', payload);
    
    return bleWrite(device, MESSAGE_TYPES.CONNECT_ONE, payload);
  }
  
export async function bleDisconnectOne(
    device: Device,
    mac: string,
  ): Promise<void> {
    const payload = {
      mac: mac
    };
    
    console.log('DISCONNECT opcode:', MESSAGE_TYPES.DISCONNECT.toString(16));
    console.log('Disconnecting speaker with payload:', payload);
    
    return bleWrite(device, MESSAGE_TYPES.DISCONNECT, payload);
  }

   // utils/ble_functions.ts
export async function fetchPairedDevices(device: Device): Promise<void> {
    // just fire-and-forget
    await bleWrite(device, MESSAGE_TYPES.GET_PAIRED_DEVICES, {});
  }
  

/**
 * Sets the latency for a specific speaker
 * @param device - The BLE device to send the command to
 * @param mac - The MAC address of the speaker
 * @param latency - The latency value to set (in milliseconds)
 * @returns Promise that resolves when the command is sent
 */
export const setLatency = async (device: Device, mac: string, latency: number): Promise<void> => {
  try {
    const payload = {
      mac: mac,
      latency: latency
    };
    
    console.log('=== Setting Latency ===');
    console.log('Device ID:', device.id);
    console.log('MAC:', mac);
    console.log('Latency:', latency);
    console.log('Opcode:', MESSAGE_TYPES.SET_LATENCY.toString(16));
    console.log('Payload:', payload);
    
    await bleWrite(device, MESSAGE_TYPES.SET_LATENCY, payload);
    console.log('Successfully sent latency command');
  } catch (error) {
    console.error('Error in setLatency:', error);
    throw error;
  }
};

/**
 * Sets the volume for a specific speaker
 * @param device - The BLE device to send the command to
 * @param mac - The MAC address of the speaker
 * @param volume - The volume value to set (0-100)
 * @param balance - The balance value (0-1, defaults to 0.5)
 * @returns Promise that resolves when the command is sent
 */
export const setVolume = async (device: Device, mac: string, volume: number, balance: number = 0.5): Promise<void> => {
  try {
    const payload = {
      mac: mac,
      volume: volume,
      balance: balance
    };
    
    console.log('=== Setting Volume ===');
    console.log('Device ID:', device.id);
    console.log('MAC:', mac);
    console.log('Volume:', volume);
    console.log('Balance:', balance);
    console.log('Opcode:', MESSAGE_TYPES.SET_VOLUME.toString(16));
    console.log('Payload:', payload);
    
    await bleWrite(device, MESSAGE_TYPES.SET_VOLUME, payload);
    console.log('Successfully sent volume command');
  } catch (error) {
    console.error('Error in setVolume:', error);
    throw error;
  }
};

/**
 * Sets the mute state for a specific speaker
 * @param device - The BLE device to send the command to
 * @param mac - The MAC address of the speaker
 * @param mute - Whether to mute (true) or unmute (false)
 * @returns Promise that resolves when the command is sent
 */
export const setMute = async (device: Device, mac: string, mute: boolean): Promise<void> => {
  try {
    const payload = {
      mac: mac,
      mute: mute
    };
    
    console.log('=== Setting Mute ===');
    console.log('Device ID:', device.id);
    console.log('MAC:', mac);
    console.log('Mute:', mute);
    console.log('Opcode:', MESSAGE_TYPES.SET_MUTE.toString(16));
    console.log('Payload:', payload);
    
    await bleWrite(device, MESSAGE_TYPES.SET_MUTE, payload);
    console.log('Successfully sent mute command');
  } catch (error) {
    console.error('Error in setMute:', error);
    throw error;
  }
};

export const startClassicPairing = async (device: Device): Promise<void> => {
  try {
    console.log('=== Starting Classic Bluetooth Pairing ===');
    await bleWrite(device, MESSAGE_TYPES.START_CLASSIC_PAIRING, {});
    console.log('Successfully sent classic pairing command');
  } catch (error) {
    console.error('Error in startClassicPairing:', error);
    throw error;
  }
};



/**
 * Fetch list of nearby classic-BT devices via Pi's GATT SCAN_DEVICES endpoint
 * @param {Device} device BLE Device connected to the Pi
 * @returns {Promise<{devices:Array<{mac:string,name:string,paired:boolean}>}>}
 */
export async function fetchScanDevices(
  device: Device
): Promise<{ devices: Array<{ mac: string; name: string; paired: boolean }> }> {
  return new Promise(async (resolve, reject) => {
    // Subscribe to notifications
    const subscription = device.monitorCharacteristicForService(
      SERVICE_UUID,
      CHARACTERISTIC_UUID,
      (error, characteristic) => {
        if (error) {
          subscription.remove();
          return reject(error);
        }
        if (characteristic?.value) {
          const decoded = decodeMessage(characteristic.value);
          if (decoded && decoded.messageType === MESSAGE_TYPES.SCAN_DEVICES) {
            subscription.remove();
            return resolve(decoded.data as { devices: Array<{ mac: string; name: string; paired: boolean }> });
          }
        }
      }
    );

    // Build and send the SCAN_DEVICES command (no payload)
    const cmdBuf = Buffer.from([MESSAGE_TYPES.SCAN_DEVICES]);
    const base64 = cmdBuf.toString('base64');
    try {
      await device.writeCharacteristicWithResponseForService(
        SERVICE_UUID,
        CHARACTERISTIC_UUID,
        base64
      );
    } catch (err) {
      subscription.remove();
      reject(err);
    }
  });
}

/**
 * Send the SCAN_START opcode to the Pi to begin streaming discovered devices.
 */
export async function startScanDevices(device: Device): Promise<void> {
  console.log('🛫 Starting streaming scan');
  return bleWrite(device, MESSAGE_TYPES.SCAN_START, {});
}

/**
 * Send the SCAN_STOP opcode to the Pi to stop streaming discovered devices.
 */
export async function stopScanDevices(device: Device): Promise<void> {
  console.log('🛑 Stopping streaming scan');
  return bleWrite(device, MESSAGE_TYPES.SCAN_STOP, {});
}