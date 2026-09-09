import test from 'node:test';
import assert from 'node:assert/strict';
import {imageSource} from './image-source.mjs';

test('native and web image imports both resolve to a URL string',()=>{
  assert.equal(imageSource('./assets/telescope.svg'),'./assets/telescope.svg');
  assert.equal(imageSource({src:'/workspace-observatory/brand/telescope.svg',width:24,height:24}),'/workspace-observatory/brand/telescope.svg');
  for(const asset of [null,undefined,{},'',{src:{}},{src:42}])assert.throws(()=>imageSource(asset));
});
