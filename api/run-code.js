const LANGUAGE_MAP = {
  python: { language: 'python3', versionIndex: '5' },
  py: { language: 'python3', versionIndex: '5' },
  javascript: { language: 'nodejs', versionIndex: '7' },
  js: { language: 'nodejs', versionIndex: '7' },
  typescript: { language: 'typescript', versionIndex: '5' },
  ts: { language: 'typescript', versionIndex: '5' },
  java: { language: 'java', versionIndex: '5' },
  c: { language: 'c', versionIndex: '5' },
  cpp: { language: 'cpp17', versionIndex: '1' },
  'c++': { language: 'cpp17', versionIndex: '1' },
  csharp: { language: 'csharp', versionIndex: '5' },
  cs: { language: 'csharp', versionIndex: '5' },
  go: { language: 'go', versionIndex: '4' },
  golang: { language: 'go', versionIndex: '4' },
  php: { language: 'php', versionIndex: '5' },
  ruby: { language: 'ruby', versionIndex: '4' },
  rust: { language: 'rust', versionIndex: '5' },
  kotlin: { language: 'kotlin', versionIndex: '4' },
  swift: { language: 'swift', versionIndex: '5' }
};

function pickMainFile(files, language) {
  if (!Array.isArray(files) || !files.length) return null;

  const normalized = String(language || '').toLowerCase();

  const extensionPriority = {
    python: ['.py'],
    py: ['.py'],
    javascript: ['.js'],
    js: ['.js'],
    typescript: ['.ts'],
    ts: ['.ts'],
    java: ['.java'],
    c: ['.c'],
    cpp: ['.cpp', '.cc', '.cxx'],
    'c++': ['.cpp', '.cc', '.cxx'],
    csharp: ['.cs'],
    cs: ['.cs'],
    go: ['.go'],
    golang: ['.go'],
    php: ['.php'],
    ruby: ['.rb'],
    rust: ['.rs'],
    kotlin: ['.kt'],
    swift: ['.swift']
  };

  const preferred = extensionPriority[normalized] || [];

  for (const ext of preferred) {
    const found = files.find((file) => String(file.name || '').toLowerCase().endsWith(ext));
    if (found) return found;
  }

  return files[0];
}

function buildScriptFromFiles(files, language) {
  if (!Array.isArray(files) || !files.length) return '';

  const mainFile = pickMainFile(files, language);
  if (!mainFile) return '';

  return String(mainFile.content || '');
}

function normalizeLanguage(input) {
  const normalized = String(input || 'python').trim().toLowerCase();
  return LANGUAGE_MAP[normalized] || LANGUAGE_MAP.python;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method Not Allowed'
    });
  }

  try {
    const clientId = process.env.JD_CLIENT_ID;
    const clientSecret = process.env.JD_CLIENT_SEC;

    if (!clientId || !clientSecret) {
      return res.status(500).json({
        success: false,
        message: 'JDoodle 环境变量未配置完整'
      });
    }

    const body = req.body || {};
    const files = Array.isArray(body.files) ? body.files : [];
    const stdin = String(body.stdin || '');
    const incomingLanguage = String(body.language || 'python');
    const runner = normalizeLanguage(incomingLanguage);
    const script = buildScriptFromFiles(files, incomingLanguage);

    if (!script.trim()) {
      return res.status(400).json({
        success: false,
        message: '没有收到可执行代码'
      });
    }

    const jdoodlePayload = {
      clientId,
      clientSecret,
      script,
      language: runner.language,
      versionIndex: runner.versionIndex,
      stdin
    };

    const response = await fetch('https://api.jdoodle.com/v1/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(jdoodlePayload)
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: data.error || 'JDoodle 调用失败',
        stderr: data.error || '',
        raw: data
      });
    }

    const output = String(data.output || '');
    const isErrorOutput =
      /error|exception|traceback|compile/i.test(output) ||
      Boolean(data.statusCode && Number(data.statusCode) !== 200);

    return res.status(200).json({
      success: !isErrorOutput,
      stdout: isErrorOutput ? '' : output,
      stderr: isErrorOutput ? output : '',
      compile_output: '',
      message: isErrorOutput ? '代码运行失败' : '代码运行成功',
      language: runner.language,
      versionIndex: runner.versionIndex,
      cpuTime: data.cpuTime || '',
      memory: data.memory || '',
      output,
      raw: data
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'run-code 服务异常',
      stderr: error instanceof Error ? error.message : 'run-code 服务异常'
    });
  }
};
