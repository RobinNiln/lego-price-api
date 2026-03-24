import express from "express";

const router = express.Router();
const API_KEY = "3-vC1o-H7i6-uYtZK";

router.post("/", async (req, res) => {
  try {
    const { method, params } = req.body;

    const body = new URLSearchParams({
      apiKey: API_KEY,
      userHash: "",
      params: JSON.stringify(params),
    });

    const r = await fetch(`https://brickset.com/api/v3.asmx/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const data = await r.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
