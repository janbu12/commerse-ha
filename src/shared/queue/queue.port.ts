export type QueuePort = {
  add(name: string, data: unknown): Promise<void>;
};
