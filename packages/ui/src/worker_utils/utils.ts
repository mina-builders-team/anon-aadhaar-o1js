import { Cache } from "o1js";


export type WorkerStatus =
  | { status: 'ready' | 'uninitialized' }
  | { status: 'computing'; message: string }
  | {status:  'computed'; message: string}
  | { status: 'errored'; error: string }

/**
 * Custom cache interface used for reading and writing compiled zkApp artifacts.
 *
 * @param files - Object containing cached file data.
 * @returns A Cache-compliant object.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-empty-pattern */
export const MinaFileSystem = (files: any): Cache => ({
  read({ persistentId, uniqueId, dataType }: any) {
    // read current uniqueId, return data if it matches
    if (!files[persistentId]) {

      return undefined;
    }

    const currentId = files[persistentId].header;

    if (currentId !== uniqueId) {

      return undefined;
    }

    if (dataType === 'string') {

      return new TextEncoder().encode(files[persistentId].data);
    }

    return undefined;
  },
  write({}: any, _data: any) {

  },
  canWrite: true,
});

/**
 * Fetches zkApp cache files required for contract interaction.
 *
 * @returns A promise resolving to the fetched zkApp cache content.
 */
export function fetchHashCacheFiles() {
  const files = [
    { name: 'lagrange-basis-fp-65536', type: 'string' },
    { name: 'lagrange-basis-fq-16384', type: 'string' },

    { name: 'srs-fp-65536', type: 'string' },
    { name: 'srs-fq-32768', type: 'string' },
    { name: 'step-vk-hash-program-hashbase', type: 'string' },
    { name: 'step-vk-hash-program-hashrecursive', type: 'string' },
    { name: 'wrap-vk-hash-program', type: 'string' },
  ];
  return fetchFiles(files, 'HashCache');
}

/**
 * Fetches zkProgram cache files.
 *
 * @returns A promise resolving to the fetched zkProgram cache content.
 */
export function fetchVerifierCacheFiles() {
  const files = [
    { name: 'step-vk-aadhaar-verifier-extractor', type: 'string' },
    { name: 'step-vk-aadhaar-verifier-verifysignature', type: 'string' },
    { name: 'wrap-vk-aadhaar-verifier', type: 'string' },
  ];
  return fetchFiles(files, 'VerifierCache');
}

/**
 * Fetches cache file headers and data from a specified folder.
 *
 * @param files - Array of file definitions with name and type.
 * @param folder - The folder path where the files are stored.
 * @returns A promise resolving to a dictionary of cached file contents.
 */
export function fetchFiles(
  files: Array<{ name: string; type: string }>,
  folder: string
) {
  
  return Promise.all(
    files.map((file) => {
      return Promise.all([
        fetch(`/${folder}/${file.name}.header`).then((res) => res.text()),
        fetch(`/${folder}/${file.name}`).then((res) => res.text()),
      ]).then(([header, data]) => ({ file, header, data }));
    })
  ).then((cacheList) =>
    cacheList.reduce((acc: any, { file, header, data }) => {
      acc[file.name] = { file, header, data };

      return acc;
    }, {})
  );
}