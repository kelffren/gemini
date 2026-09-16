/* KELO-INDEX
 * area: CREATORS / ASSET QUALITY
 * owner: Kelo Creator Asset Bridge
 * keys: PERCEPTUAL QUALITY SSIMULACRA2 BUTTERAUGLI ADVISORY IQA
 * purpose: gather optional independent perceptual metrics as advisory evidence without overriding deterministic hard gates
 * public-api: inspectPerceptualQuality()
 * state-owned: none
 * online: N/A; build/lab-time capability
 * consumes: optional iqa-cli, ssimulacra2, butteraugli CLIs
 * do-not: approve candidates that failed deterministic alpha/seam/pixel gates
 */

import {spawnSync} from 'node:child_process';

function available(command) {
  const probe = spawnSync(command, ['--help'], {stdio:'ignore', timeout:4000});
  return !probe.error || probe.error?.code !== 'ENOENT';
}

function run(command, args) {
  const result = spawnSync(command, args, {encoding:'utf8', timeout:2 * 60 * 1000});
  return {
    ok:!result.error && result.status === 0,
    status:result.status,
    stdout:String(result.stdout || '').trim(),
    stderr:String(result.stderr || '').trim(),
    error:result.error ? String(result.error.message || result.error) : null
  };
}

function finite(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseFirstNumber(text) {
  const match = String(text || '').match(/-?\d+(?:\.\d+)?/);
  return match ? finite(match[0]) : null;
}

export function inspectPerceptualQuality(referencePath, candidatePath) {
  const tools = {
    iqa:available('iqa-cli'),
    ssimulacra2:available('ssimulacra2'),
    butteraugli:available('butteraugli')
  };
  const metrics = {};
  const evidence = [];

  if (tools.iqa) {
    const result = run('iqa-cli', ['--reference', referencePath, '--distorted', candidatePath, '--metric', 'ssimulacra2,psnr,ssim,butteraugli']);
    evidence.push({tool:'iqa-cli', ...result});
    if (result.ok) {
      try {
        const parsed = JSON.parse(result.stdout);
        metrics.ssimulacra2 = finite(parsed.ssimulacra2);
        metrics.psnrExternal = finite(parsed.psnr);
        metrics.ssim = finite(parsed.ssim);
        metrics.butteraugli = finite(parsed.butteraugli);
      } catch {}
    }
  } else {
    if (tools.ssimulacra2) {
      const result = run('ssimulacra2', [referencePath, candidatePath]);
      evidence.push({tool:'ssimulacra2', ...result});
      if (result.ok) metrics.ssimulacra2 = parseFirstNumber(result.stdout);
    }
    if (tools.butteraugli) {
      const result = run('butteraugli', [referencePath, candidatePath]);
      evidence.push({tool:'butteraugli', ...result});
      if (result.ok) metrics.butteraugli = parseFirstNumber(result.stdout);
    }
  }

  const interpretations = [];
  if (metrics.ssimulacra2 != null) {
    interpretations.push(metrics.ssimulacra2 >= 90 ? 'ssimulacra2-very-high' : metrics.ssimulacra2 >= 70 ? 'ssimulacra2-high' : 'ssimulacra2-review');
  }
  if (metrics.butteraugli != null) {
    interpretations.push(metrics.butteraugli < 1 ? 'butteraugli-low-difference' : metrics.butteraugli < 2 ? 'butteraugli-subtle-difference' : 'butteraugli-review');
  }

  return {
    version:'kelo-perceptual-quality-advisory-v1',
    authority:'advisory-only',
    tools,
    metrics,
    interpretations,
    evidence
  };
}
