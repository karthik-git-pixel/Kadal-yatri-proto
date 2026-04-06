let latest = {
  lat: null,
  lon: null,
  time: null
};

export default function handler(req, res) {

  if (req.method === "POST") {

    const { lat, lon } = req.body;

    latest = {
      lat,
      lon,
      time: new Date()
    };

    return res.status(200).json({ status: "received" });
  }

  if (req.method === "GET") {
    return res.status(200).json(latest);
  }

  res.status(405).json({ message: "Method not allowed" });
}