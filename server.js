const express = require('express');
const { google } = require('googleapis');
const axios = require('axios');
const bodyParser = require('body-parser');
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'];

const auth = new google.auth.JWT(
  process.env.GOOGLE_CLIENT_EMAIL,
  null,
  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  SCOPES
);

const sheets = google.sheets({ version: 'v4', auth });

const customSearch = async (query) => {
  try {
    const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: {
        key: process.env.GOOGLE_API_KEY,
        cx: process.env.GOOGLE_SEARCH_ENGINE_ID,
        q: query
      }
    });
    const items = response.data.items;
    return items && items.length ? items[0].link : 'No results';
  } catch (error) {
    console.error(`Error in custom search: ${error.response.data.error.message}`);
    return 'Error in search';
  }
};

app.post('/scrape', async (req, res) => {
  try {
    const { spreadsheetId } = req.body;
    console.log(`Received spreadsheetId: ${spreadsheetId}`);

    const range = 'Sheet1!A:A'; // Assuming items are in column A

    const getRows = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const items = getRows.data.values.flat();
    console.log(`Fetched items: ${items}`);

    const results = [];

    for (let i = 1; i < items.length; i++) { // Start from index 1 to skip the header
      const item = items[i];
      const link = await customSearch(item);
      console.log(`Item: ${item}, Link: ${link}`);
      results.push({ item, link });
    }

    const updatedRows = results.map(({ item, link }) => [item, link]);

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Sheet1!A2:B',
      valueInputOption: 'RAW',
      resource: { values: updatedRows },
    });

    res.json({ status: 'success', data: results });
  } catch (error) {
    console.error(`Error processing request: ${error.message}`);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
