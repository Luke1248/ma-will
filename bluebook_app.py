"""
Bluebook Citation Accuracy Tester
=================================
A small web app that drills citation accuracy under The Bluebook: A Uniform
System of Citation (22nd ed.). It presents real cases and sources across every
category of authority the Bluebook covers, on a 1-5 difficulty scale.

For each citation the user decides whether it is correct. On reveal:
  * the INCORRECT portion of a flawed citation is shown in red, and the
    corrected Bluebook form is given; and
  * a properly formatted citation is marked with a check (correct) emoji.

The entire app (UI, logic, and citation bank) lives in the self-contained
``bluebook.html`` file, which also opens directly in a browser. This server is
provided so the app can be run the same way as the rest of the project.

Run:
    pip install -r requirements.txt
    python bluebook_app.py
Then open http://localhost:5001
"""

import os
from flask import Flask, send_from_directory

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


@app.route("/")
def index():
    """Serve the Bluebook citation tester."""
    return send_from_directory(BASE_DIR, "bluebook.html")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=False)
