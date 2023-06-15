const db = require('../db');

class TimerController {
  async createTimer(req, res) {
    const { timer, descr } = req.body;
    const newTimer = await db.query(
      `INSERT INTO notification (timer, descr) values ($1, $2) RETURNING *`,
      [timer, descr],
    );

    res.json(newTimer.rows[0]);
  }

  async updateTimer(req, res) {
    const { timer } = req.body;
    const updatedTimer = await db.query(
      `UPDATE notification set timer = $1 RETURNING *`,
      [timer],
    );

    res.json(updatedTimer.rows[0]);
  }

  async getTimer(req, res) {
    const id = req.params.id || 1;
    const activeTimer = await db.query(
      `SELECT * FROM notification where id = $1`,
      [id],
    );
    res.json(activeTimer.rows[0].timer);
  }
}

module.exports = new TimerController();
