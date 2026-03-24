import { Router } from "express";

const router = Router();
const API_KEY = "3-vC1o-H7i6-uYtZK";

router.options("/", (req, res) => res.sendStatus(200));

router.post("/", async (req, res) => {
  try {
    const { method, params } = req.body;
    if (!method || !params) return res.status(400).json({ error: "Missing method or params" });

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

    if (!r.ok) return res.status(502).json({ error: `Brickset HTTP ${r.status}` });
    const data = await r.json();
    res.json(data);
  } catch (err) {
    console.error("[brickset router]", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
