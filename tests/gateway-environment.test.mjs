import test from 'node:test';
import assert from 'node:assert/strict';
import {gatewayDataEnvironment} from '../candidates/base44/gateway-environment.mjs';
const token=claims=>'Bearer '+Buffer.from('{}').toString('base64url')+'.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.synthetic_signature_only';
const headers=(claims,header)=>new Headers({'Base44-Service-Authorization':token(claims),...(header===undefined?{}:{'X-Data-Env':header})});
test('observed test credential requires the matching gateway data header',()=>{
 assert.equal(gatewayDataEnvironment(headers({data_env:'dev'},'dev')),'dev');
 assert.equal(gatewayDataEnvironment(headers({data_env:'dev'})),null);
 assert.equal(gatewayDataEnvironment(headers({data_env:'dev'},'prod')),null);
});
test('live credential cannot be relabeled as test by a request header',()=>{
 assert.equal(gatewayDataEnvironment(headers({})),'prod');
 assert.equal(gatewayDataEnvironment(headers({data_env:'prod'},'prod')),'prod');
 assert.equal(gatewayDataEnvironment(headers({},'dev')),null);
});
test('opaque, malformed and unknown credential contexts fail closed',()=>{
 for(const claims of [null,[],{data_env:null},{data_env:'test'},{data_env:123}]) assert.equal(gatewayDataEnvironment(headers(claims,'dev')),null);
 for(const authorization of ['', 'Bearer opaque_token_without_claims', 'Bearer e30.e30.', 'Bearer e30.bm90anNvbg.signature']) assert.equal(gatewayDataEnvironment(new Headers({'Base44-Service-Authorization':authorization})),null);
});
