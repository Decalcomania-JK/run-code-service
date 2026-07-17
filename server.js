const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const JD_CLIENT_ID = process.env.JD_CLIENT_ID;
const JD_CLIENT_SEC = process.env.JD_CLIENT_SEC;
const JD_API_URL = "https://api.jdoodle.com/v1/execute";

app.post("/api/run-code", async (req, res) => {
  try {
    const { script, language, versionIndex } = req.body;
    const payload = {
      clientId: JD_CLIENT_ID,
      clientSecret: JD_CLIENT_SEC,
      script: script,
      language: language,
      versionIndex: versionIndex ?? "0"
    };
    const jdRes = await axios.post(JD_API_URL, payload);
    res.json({
      success: true,
      output: jdRes.data.output,
      memory: jdRes.data.memory,
      cpuTime: jdRes.data.cpuTime
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      msg: "代码执行失败",
      error: err.response?.data || err.message
    });
  }
});

app.get("/", (req, res) => {
  res.send("Run Code Service Active");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Service running on port ${PORT}`);
});