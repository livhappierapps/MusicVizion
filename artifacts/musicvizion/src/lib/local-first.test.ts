import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTrackSource } from './track-source.ts';
import { validateProfiles } from './profiles.ts';
import { localGuide } from './local-guide.ts';

test('public platform links are classified without fetching media', () => {
  for (const url of ['https://youtu.be/dQw4w9WgXcQ','https://www.youtube.com/watch?v=dQw4w9WgXcQ','https://youtube.com/shorts/dQw4w9WgXcQ']) {
    assert.equal(parseTrackSource(url).kind,'youtube');
  }
  assert.equal(parseTrackSource('https://suno.com/song/example').kind,'suno');
  assert.equal(parseTrackSource('https://example.com/song.mp3').kind,'direct');
  assert.equal(parseTrackSource('https://notyoutube.com/?v=dQw4w9WgXcQ').kind,'direct');
  assert.throws(()=>parseTrackSource('javascript:alert(1)'));
  assert.throws(()=>parseTrackSource('https://youtube.com/watch?v=invalid'));
  assert.throws(()=>parseTrackSource('http://example.com/audio.mp3'));
});
test('malformed storage and invalid selected companion recover without unsafe values', () => {
  assert.equal(validateProfiles(null).profiles.length,1);
  const clean = validateProfiles({profiles:[{id:'one',name:' One ',notes:['fine',null,42]},{id:'two',name:'Two',notes:['distinct']}],activeId:'missing'});
  assert.equal(clean.activeId,'one'); assert.deepEqual(clean.profiles[0].notes,['fine']);
  assert.deepEqual(clean.profiles[1].notes,['distinct']);
  assert.equal(validateProfiles({profiles:Array.from({length:20},(_,i)=>({id:String(i),name:'X',notes:['a'.repeat(900)]}))}).profiles.length,8);
});
test('free guide distinguishes listening prompts from hearing, AI, and influence claims', () => {
  const input = {title:'Test',artist:'Local',userMessage:'Compare with Beethoven',positionSeconds:65,analysis:{source:'unavailable'},preferences:[]};
  assert.match(localGuide(input),/1:05/);
  assert.match(localGuide(input),/not evidence/);
  assert.match(localGuide({...input,userMessage:'What should I notice?'}),/not a Grok response/);
});
