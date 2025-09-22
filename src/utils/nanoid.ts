export function nanoid(size = 12){
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let id = ''; const arr = new Uint8Array(size);
  crypto.getRandomValues(arr);
  for (let i=0;i<size;i++) id += chars[arr[i] % chars.length];
  return id;
}
