const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();
require('dotenv').config()

if (!process.env.CHATGPT_API_KEY) {
  console.log('CHATGPT_API_KEY env variable required');
  process.exit(1);
}

app.use(bodyParser.json());

const dialogues = {};

const proxy = (() => {
  if (!process.env.PROXY) {
    return;
  }
  const parsedProxyUrl = new URL(process.env.PROXY);

  return {
    protocol: parsedProxyUrl.protocol.replace(':', ''),
    host: parsedProxyUrl.hostname,
    port: parseInt(parsedProxyUrl.port, 10),
    auth: parsedProxyUrl.username ? {
      username: parsedProxyUrl.username || undefined,
      password: parsedProxyUrl.password || undefined
    } : undefined
  }
})();

app.post("/", async (req, res) => {

  const sessionId = req.body.session.session_id;

  if (!dialogues[sessionId]) {
    dialogues[sessionId] = [
      {
        role: "system",
        content: process.env.PROMPT || "Твоя задача отвечать максимально коротко в одно/два предложения."
      }
    ];
  }

  const userQuestion = req.body.request.original_utterance;

  dialogues[sessionId].push({
    role: "user",
    content: userQuestion
  });

  const response = {
    version: req.body.version,
    session: req.body.session,
    response: {
      end_session: false
    }
  };

  try {
    const chatResponse = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: "gpt-3.5-turbo",
          messages: dialogues[sessionId],
          temperature: 0.5,
          max_tokens: 300
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.CHATGPT_API_KEY}`,
            'Content-Type': 'application/json'
          },
          proxy
        }
    );

    const chatGptAnswer = chatResponse.data.choices[0].message.content;

    response.response.text = chatGptAnswer

    dialogues[sessionId].push({
      role: "assistant",
      content: chatGptAnswer
    });

    console.log('>>>', userQuestion)
    console.log('<<<', chatGptAnswer, '\n')

  } catch (error) {
    if (error.response && error.response.data) {
      console.log(error.response.data)
    }
    if (error.response && error.response.status === 401) {
      response.response.text = 'Запрет на использование сервиса.';
    } else if (error.response && error.response.status === 429) {
      response.response.text = 'Очень много вопросов, подожди немного.';
    } else {
      console.log(error);
      response.response.text = 'Произошла непонятная ошибка при обработке вашего запроса.';
    }
  }

  res.json(response);
});

app.listen(3000, () => console.log('Server running on port 3000'));