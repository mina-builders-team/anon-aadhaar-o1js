import { JsonProof} from "o1js";
export {openDB, saveProof, loadProof, saveVK, loadVK}

function openDB(version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // bump version to force upgrade
    const request = indexedDB.open('aadhaar-proofs', version);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('proofs')) {
        db.createObjectStore('proofs', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('verificationKeys')) {
        db.createObjectStore('verificationKeys', { keyPath: 'id' });
      }
      console.log('Database upgrade completed');
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveProof(id: string, proof: JsonProof, version: number): Promise<void> {
  const db = await openDB(version);
  const tx = db.transaction('proofs', 'readwrite');
  const store = tx.objectStore('proofs');
  
  return new Promise((resolve, reject) => {
    const request = store.put({ id, proof });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function saveVK(id: string, vk: string, version: number): Promise<void> {
  const db = await openDB(version);
  const tx = db.transaction('verificationKeys', 'readwrite');
  const store = tx.objectStore('verificationKeys');

  await store.put({ id, vk }); // use the passed id here
}

async function loadVK(id: string, version: number): Promise<string | null> {
  const db = await openDB(version);
  const tx = db.transaction('verificationKeys', 'readonly');
  const req = tx.objectStore('verificationKeys').get(id); // use the passed id here
  return new Promise((resolve, reject) => {
    req.onsuccess = () => {
      if (req.result) resolve(req.result.vk );
      else resolve(null);
    };
    req.onerror = () => reject(req.error);
  });

}

async function loadProof(id: string, version: number): Promise<JsonProof | null> {
  const db = await openDB(version);
  const tx = db.transaction('proofs', 'readonly');
  const req = tx.objectStore('proofs').get(id); // use the passed id here
  return new Promise((resolve, reject) => {
    req.onsuccess = () => {
      if (req.result) resolve(req.result.proof as JsonProof);
      else resolve(null);
    };
    req.onerror = () => reject(req.error);
  });
}
