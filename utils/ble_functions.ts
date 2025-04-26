// utils/ble_functions.ts
import { BleManager, Device } from 'react-native-ble-plx';
import { Buffer } from 'buffer';

const manager = new BleManager();

/*
 * ────────────────────────────────────────────────────
 *  UUIDs (must match the Pi backend)
 * ────────────────────────────────────────────────────
 */
export const BLE_DEVICE_NAME = 'SyncSonic';
export const SERVICE_UUID = '19b10000-e8f2-537e-4f6c-d104768a1214';  // Updated to match actual service
export const CHARACTERISTIC_UUID = '19b10001-e8f2-537e-4f6c-d104768a1217';  // Updated to match actual characteristic
export const MESSAGE_TYPES = {
    CONNECT_ONE: 0x60,
    // add others as you migrate volume / latency, etc.
  };
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
async function bleWrite(device: Device, messageType: number, payload: object): Promise<void> {
  if (!device) throw new Error('No device provided');

  try {
    // Convert payload to JSON string
    const jsonString = JSON.stringify(payload);
    console.log('Message Type (opcode):', messageType.toString(16)); // Log opcode in hex
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
    console.log('Base64 encoded message:', base64Data);
    console.log('First byte (opcode) in hex:', messageBuffer[0].toString(16));

    // Get the service and characteristic
    const services = await device.services();
    const service = services.find(s => s.uuid.toLowerCase() === SERVICE_UUID.toLowerCase());
    if (!service) throw new Error('GATT service not found');

    const chars = await service.characteristics();
    const char = chars.find(c => c.uuid.toLowerCase() === CHARACTERISTIC_UUID.toLowerCase());
    if (!char) throw new Error('Characteristic not found');

    // Write the data
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
  ): Promise<void> {
    const payload = {
      targetSpeaker: { mac, name },
      settings: { [mac]: settings }
    };
    
    console.log('CONNECT_ONE opcode:', MESSAGE_TYPES.CONNECT_ONE.toString(16));
    console.log('Connecting speaker with payload:', payload);
    
    return bleWrite(device, MESSAGE_TYPES.CONNECT_ONE, payload);
  }
  


