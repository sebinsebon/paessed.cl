import JSZip from 'jszip';
import Reader from './paessed-runtime/package-reader.js';
import Validator from './paessed-runtime/validator.js';
export type PaessedResource={id:string;path:string;sha256:string};
export type PaessedValidation={resources:Map<string,PaessedResource>;warnings:string[]};
export type PaessedResult={data:unknown;validation:PaessedValidation;blobs:Map<string,Blob>;manifest:unknown};
export const validatePaessed = (data: unknown):PaessedValidation => Validator.validateFinal(data);
export const readPaessed = (input: Blob | Uint8Array):Promise<PaessedResult> => Reader.readPackage(input, {JSZip});
export const sha256 = (bytes: Uint8Array):Promise<string> => Reader.sha256(bytes);
