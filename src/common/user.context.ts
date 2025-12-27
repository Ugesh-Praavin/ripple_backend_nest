export interface RequestUser {
  uid: string;
  email: string;
  role: 'ADMIN' | 'SUPERVISOR';
  block_id?: string;
}
