import { DAAdapter } from "../index";

export const CelestiaAdapter: DAAdapter = {
  name: "Celestia",
  async publishBlob(data: Uint8Array) {
    return `celestia:${Date.now()}:${data.length}`;
  },
  async verifyAvailability(handle: string) {
    return true;
  },
  async costEstimate(bytes: number) {
    return Math.max(1, Math.round(bytes / 1024));
  }
};
