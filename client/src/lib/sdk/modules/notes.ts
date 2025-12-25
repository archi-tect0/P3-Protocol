import { sdkReq } from './core';

export type Note = {
  id: string;
  title: string;
  content: string;
  encrypted: boolean;
  createdAt: number;
  updatedAt: number;
  owner: string;
};

export type CreateNoteResult = {
  ok: boolean;
  noteId: string;
  note: Note;
};

export type ListNotesResult = {
  notes: Note[];
};

export type GetNoteResult = {
  note: Note;
};

export type UpdateNoteData = {
  title?: string;
  content?: string;
  encrypted?: boolean;
};

export type UpdateNoteResult = {
  ok: boolean;
  note: Note;
};

export type DeleteNoteResult = {
  ok: boolean;
};

export async function create(title: string, content: string, encrypted = false): Promise<CreateNoteResult> {
  return sdkReq<CreateNoteResult>('/api/nexus/notes', {
    method: 'POST',
    body: JSON.stringify({ title, content, encrypted }),
  });
}

export async function list(): Promise<ListNotesResult> {
  return sdkReq<ListNotesResult>('/api/nexus/notes', {
    method: 'GET',
  });
}

export async function get(id: string): Promise<GetNoteResult> {
  return sdkReq<GetNoteResult>(`/api/nexus/notes/${encodeURIComponent(id)}`, {
    method: 'GET',
  });
}

export async function update(id: string, data: UpdateNoteData): Promise<UpdateNoteResult> {
  return sdkReq<UpdateNoteResult>(`/api/nexus/notes/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteNote(id: string): Promise<DeleteNoteResult> {
  return sdkReq<DeleteNoteResult>(`/api/nexus/notes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export type NotesAPI = {
  create: typeof create;
  list: typeof list;
  get: typeof get;
  update: typeof update;
  delete: typeof deleteNote;
};

export function createNotesAPI(): NotesAPI {
  return {
    create,
    list,
    get,
    update,
    delete: deleteNote,
  };
}
