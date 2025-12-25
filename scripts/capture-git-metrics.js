#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function exec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 30000 }).trim();
  } catch (e) {
    return '';
  }
}

function captureMetrics() {
  const totalCommits = parseInt(exec('git rev-list --count HEAD')) || 0;
  const commitsToday = parseInt(exec('git rev-list --count --since="midnight" HEAD')) || 0;
  const commitsThisWeek = parseInt(exec('git rev-list --count --since="1 week ago" HEAD')) || 0;
  const commitsThisMonth = parseInt(exec('git rev-list --count --since="1 month ago" HEAD')) || 0;
  
  const contributors = parseInt(exec('git shortlog -sn HEAD | wc -l')) || 1;
  const branches = parseInt(exec('git branch -r | wc -l')) || 1;
  
  // Lines of code
  const totalLines = parseInt(exec("find . -type f \\( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.css' -o -name '*.sql' -o -name '*.json' \\) ! -path './node_modules/*' ! -path './.git/*' ! -path './dist/*' -exec cat {} + 2>/dev/null | wc -l")) || 0;
  
  // Recent file changes
  const diffStat = exec('git diff --stat HEAD~10 HEAD 2>/dev/null') || '';
  let filesModified = 0, linesAdded = 0, linesRemoved = 0;
  const summaryMatch = diffStat.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
  if (summaryMatch) {
    filesModified = parseInt(summaryMatch[1]) || 0;
    linesAdded = parseInt(summaryMatch[2]) || 0;
    linesRemoved = parseInt(summaryMatch[3]) || 0;
  }
  
  const healthScore = Math.min(100, Math.round(
    (commitsThisWeek > 0 ? 30 : 0) +
    (commitsThisMonth > 5 ? 30 : commitsThisMonth * 6) +
    (contributors > 0 ? 20 : 0) +
    (linesAdded >= linesRemoved ? 20 : 10)
  ));
  
  const snapshot = {
    capturedAt: new Date().toISOString(),
    commits: { today: commitsToday, thisWeek: commitsThisWeek, thisMonth: commitsThisMonth, total: totalCommits },
    linesOfCode: { added: linesAdded, removed: linesRemoved, net: linesAdded - linesRemoved, total: totalLines },
    files: { created: 0, modified: filesModified, deleted: 0 },
    contributors,
    branches,
    healthScore,
    narrative: `Production snapshot: ${totalCommits} commits, ${Math.round(totalLines/1000)}K lines across ${contributors} contributors. Captured ${new Date().toISOString().split('T')[0]}.`
  };
  
  const outPath = path.join(__dirname, '..', 'server', 'atlas', 'data', 'git-snapshot.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
  
  console.log('Git metrics snapshot captured:');
  console.log(JSON.stringify(snapshot, null, 2));
}

captureMetrics();
