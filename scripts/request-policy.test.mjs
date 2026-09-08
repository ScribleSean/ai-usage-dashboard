import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allowedLocalRequest} from './request-policy.mjs';
const headers={host:'127.0.0.1:5601','sec-fetch-site':'cross-site','sec-fetch-mode':'navigate','sec-fetch-dest':'document'};
test('external links may open the local dashboard document',()=>{
  for (const method of ['GET','HEAD']) for(const url of ['/','/?view=tokens']) assert.equal(allowedLocalRequest({method,url,headers}),true);
});
test('external links cannot navigate to private data or a foreign host',()=>{
  for(const url of ['/local/usage.json','/local/collector.json','/index.html','//foreign.example/','/%2e/']) assert.equal(allowedLocalRequest({method:'GET',url,headers}),false);
  assert.equal(allowedLocalRequest({method:'GET',url:'/',headers:{...headers,host:'foreign.example'}}),false);
});
test('cross-site fetch, frames and writes remain forbidden',()=>{
  for(const override of [{'sec-fetch-mode':'cors'},{'sec-fetch-mode':'no-cors'},{'sec-fetch-dest':'iframe'},{'sec-fetch-mode':undefined}]) assert.equal(allowedLocalRequest({method:'GET',url:'/',headers:{...headers,...override}}),false);
  assert.equal(allowedLocalRequest({method:'POST',url:'/',headers}),false);
});
test('normal same-origin and command-line reads remain available',()=>{
  for(const host of ['127.0.0.1:5601','localhost:5601']) assert.equal(allowedLocalRequest({method:'GET',url:'/local/usage.json',headers:{host}}),true);
});
