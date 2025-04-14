import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
export interface Configuration {
  id: number;
  name: string;
  isConnected: boolean;
  speakerCount: number;
}

export interface Speaker {
  id: number;
  config_id: number;
  name: string;
  mac: string;
  volume: number;
  latency: number;
  is_connected: boolean;
}

// Keys
const CONFIGURATIONS_KEY = '@syncsonic/configurations';
const SPEAKERS_KEY = '@syncsonic/speakers';

// Helper functions
const getNextId = (items: any[]): number => {
  return items.length > 0 ? Math.max(...items.map(item => item.id)) + 1 : 1;
};

// Initialize storage
export const setupDatabase = async () => {
  try {
    const configs = await AsyncStorage.getItem(CONFIGURATIONS_KEY);
    const speakers = await AsyncStorage.getItem(SPEAKERS_KEY);
    
    if (!configs) {
      await AsyncStorage.setItem(CONFIGURATIONS_KEY, JSON.stringify([]));
    }
    if (!speakers) {
      await AsyncStorage.setItem(SPEAKERS_KEY, JSON.stringify([]));
    }
  } catch (error) {
    console.error('Error setting up database:', error);
  }
};

// Configuration functions
export const addConfiguration = async (name: string): Promise<number> => {
  try {
    const configs = JSON.parse(await AsyncStorage.getItem(CONFIGURATIONS_KEY) || '[]');
    const newConfig: Configuration = {
      id: getNextId(configs),
      name,
      isConnected: false,
      speakerCount: 0
    };
    configs.push(newConfig);
    await AsyncStorage.setItem(CONFIGURATIONS_KEY, JSON.stringify(configs));
    return newConfig.id;
  } catch (error) {
    console.error('Error adding configuration:', error);
    throw error;
  }
};

export const getConfigurations = async (): Promise<Configuration[]> => {
  try {
    const configs = JSON.parse(await AsyncStorage.getItem(CONFIGURATIONS_KEY) || '[]');
    const speakers = JSON.parse(await AsyncStorage.getItem(SPEAKERS_KEY) || '[]');
    
    return configs.map((config: Configuration) => ({
      ...config,
      speakerCount: speakers.filter((s: Speaker) => s.config_id === config.id).length
    }));
  } catch (error) {
    console.error('Error getting configurations:', error);
    return [];
  }
};

export const updateConfiguration = async (id: number, name: string) => {
  try {
    const configs = JSON.parse(await AsyncStorage.getItem(CONFIGURATIONS_KEY) || '[]');
    const index = configs.findIndex((c: Configuration) => c.id === id);
    if (index !== -1) {
      configs[index].name = name;
      await AsyncStorage.setItem(CONFIGURATIONS_KEY, JSON.stringify(configs));
    }
  } catch (error) {
    console.error('Error updating configuration:', error);
  }
};

export const deleteConfiguration = async (id: number) => {
  try {
    const configs = JSON.parse(await AsyncStorage.getItem(CONFIGURATIONS_KEY) || '[]');
    const speakers = JSON.parse(await AsyncStorage.getItem(SPEAKERS_KEY) || '[]');
    
    // Delete configuration
    const newConfigs = configs.filter((c: Configuration) => c.id !== id);
    await AsyncStorage.setItem(CONFIGURATIONS_KEY, JSON.stringify(newConfigs));
    
    // Delete associated speakers
    const newSpeakers = speakers.filter((s: Speaker) => s.config_id !== id);
    await AsyncStorage.setItem(SPEAKERS_KEY, JSON.stringify(newSpeakers));
  } catch (error) {
    console.error('Error deleting configuration:', error);
  }
};

// Speaker functions
export const addSpeaker = async (configId: number, name: string, mac: string, volume: number = 50, latency: number = 100) => {
  try {
    const speakers = JSON.parse(await AsyncStorage.getItem(SPEAKERS_KEY) || '[]');
    const newSpeaker: Speaker = {
      id: getNextId(speakers),
      config_id: configId,
      name,
      mac,
      volume,
      latency,
      is_connected: false
    };
    speakers.push(newSpeaker);
    await AsyncStorage.setItem(SPEAKERS_KEY, JSON.stringify(speakers));
  } catch (error) {
    console.error('Error adding speaker:', error);
  }
};

export const getSpeakers = async (configId: number): Promise<Speaker[]> => {
  try {
    const speakers = JSON.parse(await AsyncStorage.getItem(SPEAKERS_KEY) || '[]');
    return speakers.filter((s: Speaker) => s.config_id === configId);
  } catch (error) {
    console.error('Error getting speakers:', error);
    return [];
  }
};

export const getSpeakersFull = async (configId: number): Promise<Speaker[]> => {
  try {
    const speakers = JSON.parse(await AsyncStorage.getItem(SPEAKERS_KEY) || '[]');
    return speakers.filter((s: Speaker) => s.config_id === configId);
  } catch (error) {
    console.error('Error getting speakers:', error);
    return [];
  }
};

export const deleteSpeaker = async (id: number) => {
  try {
    const speakers = JSON.parse(await AsyncStorage.getItem(SPEAKERS_KEY) || '[]');
    const newSpeakers = speakers.filter((s: Speaker) => s.id !== id);
    await AsyncStorage.setItem(SPEAKERS_KEY, JSON.stringify(newSpeakers));
  } catch (error) {
    console.error('Error deleting speaker:', error);
  }
};

export const deleteSpeakerById = async (id: number) => {
  await deleteSpeaker(id);
};

export const updateSpeakerSettings = async (configId: number, mac: string, volume: number, latency: number) => {
  try {
    const speakers = JSON.parse(await AsyncStorage.getItem(SPEAKERS_KEY) || '[]');
    const index = speakers.findIndex((s: Speaker) => s.config_id === configId && s.mac === mac);
    if (index !== -1) {
      speakers[index].volume = volume;
      speakers[index].latency = latency;
      await AsyncStorage.setItem(SPEAKERS_KEY, JSON.stringify(speakers));
    }
  } catch (error) {
    console.error('Error updating speaker settings:', error);
  }
};

export const updateSpeakerConnectionStatus = async (configId: number, mac: string, isConnected: boolean) => {
  try {
    const speakers = JSON.parse(await AsyncStorage.getItem(SPEAKERS_KEY) || '[]');
    const index = speakers.findIndex((s: Speaker) => s.config_id === configId && s.mac === mac);
    if (index !== -1) {
      speakers[index].is_connected = isConnected;
      await AsyncStorage.setItem(SPEAKERS_KEY, JSON.stringify(speakers));
    }
  } catch (error) {
    console.error('Error updating speaker connection status:', error);
  }
};

export const updateConnectionStatus = async (id: number, status: number) => {
  try {
    const configs = JSON.parse(await AsyncStorage.getItem(CONFIGURATIONS_KEY) || '[]');
    const index = configs.findIndex((c: Configuration) => c.id === id);
    if (index !== -1) {
      configs[index].isConnected = status === 1;
      await AsyncStorage.setItem(CONFIGURATIONS_KEY, JSON.stringify(configs));
    }
  } catch (error) {
    console.error('Error updating connection status:', error);
  }
};

export const getConfigurationStatus = async (configId: number): Promise<number> => {
  try {
    const configs = JSON.parse(await AsyncStorage.getItem(CONFIGURATIONS_KEY) || '[]');
    const config = configs.find((c: Configuration) => c.id === configId);
    return config ? (config.isConnected ? 1 : 0) : 0;
  } catch (error) {
    console.error('Error getting configuration status:', error);
    return 0;
  }
};

export const getConfigurationSettings = async (configId: number): Promise<{ [mac: string]: { volume: number, latency: number } }> => {
  try {
    const speakers = JSON.parse(await AsyncStorage.getItem(SPEAKERS_KEY) || '[]');
    const settings: { [mac: string]: { volume: number, latency: number } } = {};
    speakers
      .filter((s: Speaker) => s.config_id === configId)
      .forEach((s: Speaker) => {
        settings[s.mac] = { volume: s.volume, latency: s.latency };
      });
    return settings;
  } catch (error) {
    console.error('Error getting configuration settings:', error);
    return {};
  }
};

// Debug functions
export const logDatabaseContents = async () => {
  try {
    const configs = await AsyncStorage.getItem(CONFIGURATIONS_KEY);
    const speakers = await AsyncStorage.getItem(SPEAKERS_KEY);
    console.log("Configurations:", configs);
    console.log("Speakers:", speakers);
  } catch (error) {
    console.error('Error logging database contents:', error);
  }
};

export const resetDatabase = async () => {
  try {
    await AsyncStorage.setItem(CONFIGURATIONS_KEY, JSON.stringify([]));
    await AsyncStorage.setItem(SPEAKERS_KEY, JSON.stringify([]));
  } catch (error) {
    console.error('Error resetting database:', error);
  }
};