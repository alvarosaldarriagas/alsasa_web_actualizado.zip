// INACTIVE factory: strict validator is fixed here, never provided by request data.
import {createRotatingReceiver} from '../inbox-2026-09-15/rotating-receiver.mjs';
import {validateCapture} from './capture-validator.mjs';
export function createValidatedReceiver(config={}){
 const kind=config.kind;
 return createRotatingReceiver({...config,validate:body=>validateCapture(kind,body)});
}
