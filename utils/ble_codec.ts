/* utils/ble_codec.ts -------------------------------------------------*/
export function encode(type: number, data: any = {}): string {
    const json = JSON.stringify(data);
    const bytes = new Uint8Array(1 + json.length);
    bytes[0] = type;
    bytes.set(new TextEncoder().encode(json), 1);
    return btoa(String.fromCharCode(...bytes));
  }
  
  export function decode(b64: string) {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const type  = bytes[0];
    const json  = bytes.length > 1 ? JSON.parse(new TextDecoder().decode(bytes.slice(1))) : {};
    return { type, json };
  }