import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type {
  DID,
  CID,
  VideoChunk,
  StreamManifest,
  CommentEvent,
  ReactionEvent,
  BookmarkEvent,
  Profile,
} from '@shared/nodestream-types';

type StreamEvent = CommentEvent | ReactionEvent | BookmarkEvent;

interface ChunkRecord {
  cid: CID;
  chunk: VideoChunk;
  data: ArrayBuffer;
  timestamp: number;
}

interface ManifestRecord {
  streamId: string;
  manifest: StreamManifest;
  timestamp: number;
}

interface EventRecord {
  eventId: string;
  streamId: string;
  event: StreamEvent;
  eventType: 'comment' | 'reaction' | 'bookmark';
  timestamp: number;
}

interface ProfileRecord {
  did: DID;
  profile: Profile;
  timestamp: number;
}

interface FeedRecord {
  streamId: string;
  manifest: StreamManifest;
  addedAt: number;
}

interface NodeStreamDB extends DBSchema {
  chunks: {
    key: CID;
    value: ChunkRecord;
    indexes: { 'by-timestamp': number };
  };
  manifests: {
    key: string;
    value: ManifestRecord;
    indexes: { 'by-timestamp': number; 'by-owner': DID };
  };
  events: {
    key: string;
    value: EventRecord;
    indexes: { 'by-streamId': string; 'by-timestamp': number };
  };
  profiles: {
    key: DID;
    value: ProfileRecord;
    indexes: { 'by-timestamp': number };
  };
  feed: {
    key: string;
    value: FeedRecord;
    indexes: { 'by-addedAt': number };
  };
}

const DB_NAME = 'nodestream-store';
const DB_VERSION = 1;

export class Store {
  private db: IDBPDatabase<NodeStreamDB> | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      this.db = await openDB<NodeStreamDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('chunks')) {
            const chunksStore = db.createObjectStore('chunks', { keyPath: 'cid' });
            chunksStore.createIndex('by-timestamp', 'timestamp');
          }

          if (!db.objectStoreNames.contains('manifests')) {
            const manifestsStore = db.createObjectStore('manifests', { keyPath: 'streamId' });
            manifestsStore.createIndex('by-timestamp', 'timestamp');
            manifestsStore.createIndex('by-owner', 'manifest.owner');
          }

          if (!db.objectStoreNames.contains('events')) {
            const eventsStore = db.createObjectStore('events', { keyPath: 'eventId' });
            eventsStore.createIndex('by-streamId', 'streamId');
            eventsStore.createIndex('by-timestamp', 'timestamp');
          }

          if (!db.objectStoreNames.contains('profiles')) {
            const profilesStore = db.createObjectStore('profiles', { keyPath: 'did' });
            profilesStore.createIndex('by-timestamp', 'timestamp');
          }

          if (!db.objectStoreNames.contains('feed')) {
            const feedStore = db.createObjectStore('feed', { keyPath: 'streamId' });
            feedStore.createIndex('by-addedAt', 'addedAt');
          }
        },
      });
    })();

    return this.initPromise;
  }

  private async ensureInit(): Promise<IDBPDatabase<NodeStreamDB>> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');
    return this.db;
  }

  async putChunk(chunk: VideoChunk, data: ArrayBuffer): Promise<void> {
    const db = await this.ensureInit();
    const record: ChunkRecord = {
      cid: chunk.cid,
      chunk,
      data,
      timestamp: Date.now(),
    };
    await db.put('chunks', record);
  }

  async getChunk(cid: CID): Promise<ArrayBuffer | null> {
    const db = await this.ensureInit();
    const record = await db.get('chunks', cid);
    return record?.data ?? null;
  }

  async getChunkRecord(cid: CID): Promise<ChunkRecord | null> {
    const db = await this.ensureInit();
    const record = await db.get('chunks', cid);
    return record ?? null;
  }

  async putManifest(manifest: StreamManifest): Promise<void> {
    const db = await this.ensureInit();
    const record: ManifestRecord = {
      streamId: manifest.streamId,
      manifest,
      timestamp: Date.now(),
    };
    await db.put('manifests', record);

    const feedRecord: FeedRecord = {
      streamId: manifest.streamId,
      manifest,
      addedAt: Date.now(),
    };
    await db.put('feed', feedRecord);
  }

  async getManifest(streamId: string): Promise<StreamManifest | null> {
    const db = await this.ensureInit();
    const record = await db.get('manifests', streamId);
    return record?.manifest ?? null;
  }

  async appendEvent(event: StreamEvent): Promise<void> {
    const db = await this.ensureInit();

    let streamId: string;
    let eventType: 'comment' | 'reaction' | 'bookmark';

    if ('parentStreamId' in event) {
      streamId = event.parentStreamId;
      eventType = 'comment';
    } else if ('kind' in event) {
      streamId = event.targetStreamId;
      eventType = 'reaction';
    } else {
      streamId = event.targetStreamId;
      eventType = 'bookmark';
    }

    const record: EventRecord = {
      eventId: event.eventId,
      streamId,
      event,
      eventType,
      timestamp: Date.now(),
    };
    await db.put('events', record);
  }

  async getEvents(streamId: string): Promise<StreamEvent[]> {
    const db = await this.ensureInit();
    const records = await db.getAllFromIndex('events', 'by-streamId', streamId);
    return records.map((r) => r.event);
  }

  async getEventsByType(
    streamId: string,
    eventType: 'comment' | 'reaction' | 'bookmark'
  ): Promise<StreamEvent[]> {
    const db = await this.ensureInit();
    const records = await db.getAllFromIndex('events', 'by-streamId', streamId);
    return records.filter((r) => r.eventType === eventType).map((r) => r.event);
  }

  async getAllManifests(): Promise<StreamManifest[]> {
    const db = await this.ensureInit();
    const records = await db.getAllFromIndex('feed', 'by-addedAt');
    return records.map((r) => r.manifest).reverse();
  }

  async getBookmarks(did: DID): Promise<BookmarkEvent[]> {
    const db = await this.ensureInit();
    const allEvents = await db.getAll('events');
    return allEvents
      .filter((r) => r.eventType === 'bookmark' && (r.event as BookmarkEvent).author === did)
      .map((r) => r.event as BookmarkEvent);
  }

  async putProfile(profile: Profile): Promise<void> {
    const db = await this.ensureInit();
    const record: ProfileRecord = {
      did: profile.did,
      profile,
      timestamp: Date.now(),
    };
    await db.put('profiles', record);
  }

  async getProfile(did: DID): Promise<Profile | null> {
    const db = await this.ensureInit();
    const record = await db.get('profiles', did);
    return record?.profile ?? null;
  }

  async deleteChunk(cid: CID): Promise<void> {
    const db = await this.ensureInit();
    await db.delete('chunks', cid);
  }

  async deleteManifest(streamId: string): Promise<void> {
    const db = await this.ensureInit();
    await db.delete('manifests', streamId);
    await db.delete('feed', streamId);
  }

  async clear(): Promise<void> {
    const db = await this.ensureInit();
    await db.clear('chunks');
    await db.clear('manifests');
    await db.clear('events');
    await db.clear('profiles');
    await db.clear('feed');
  }
}

export const nodeStreamStore = new Store();
