// BLE Constants
export const BLE_DEVICE_NAME = "Sync-Sonic";
export const SERVICE_UUID = "19b10000-e8f2-537e-4f6c-d104768a1214";
export const CHARACTERISTIC_UUID = "19b10001-e8f2-537e-4f6c-d104768a1217";

// Message Types (must match backend)
export const MESSAGE_TYPES = {
  // Ping/Pong
  PING: 0x01,
  PONG: 0x02,
  ERROR: 0x03,
  // Response types
  SUCCESS: 0xF0,
  FAILURE: 0xF1,
  // Connection related
  CONNECT_ONE: 0x60,
  DISCONNECT: 0x61,
  // Volume and latency
  SET_LATENCY: 0x62,
  SET_VOLUME: 0x63,
  // Device management
  GET_PAIRED_DEVICES: 0x64,
  // Mute control
  SET_MUTE: 0x65,
  START_CLASSIC_PAIRING: 0x66,  
  // Connection Status Update
  CONNECTION_STATUS_UPDATE: 0x70,  // General connection status update
  SCAN_DEVICES : 0x43,
  SCAN_START   : 0x40,
  SCAN_STOP    : 0x41
} as const; 