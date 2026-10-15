import type { CompanionInput } from '@workspace/api-client-react';

export function localGuide(input: CompanionInput) {
  const introduction = `At ${Math.floor(input.positionSeconds / 60)}:${String(Math.floor(input.positionSeconds % 60)).padStart(2, '0')} of ${input.title}, try a focused second listen.`;
  if (/beethoven|history|historical/i.test(input.userMessage)) {
    return `${introduction} Beethoven often develops short motifs through repetition, changes of register, and contrast. Listen for one short idea here: does it return unchanged, grow, or get interrupted? Then compare with call-and-response in blues or layered independent lines in Bach. This is a listening exercise, not evidence that this track borrowed from those traditions.`;
  }
  if (/feel|love|like|appreciat/i.test(input.userMessage)) {
    return `${introduction} Notice the sound that attracts you first: a voice, a bass movement, a tiny silence, or a change in texture. Describe what it does to your sense of tension and release, then save that observation in your companion’s notes. This local guide does not hear the track or experience feelings; your reaction provides the appreciation.`;
  }
  const measured = input.analysis.energy != null ? ` The current rough level meter is ${input.analysis.energy}/100; it describes signal level, not quality or popularity.` : ' No browser-readable audio measurements are available for this source yet.';
  return `${introduction}${measured} Focus on pulse, foreground melody, background texture, and the next moment of contrast. Pause when something changes and name what you noticed. This is a free, rule-based listening guide—not a Grok response or an automatic hit prediction.`;
}
