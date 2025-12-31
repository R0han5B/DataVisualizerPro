# 📊 DataVisualizerPro

**DataVisualizerPro** is a web-based data visualization application that combines **Python-based data analysis** with a **JavaScript-driven web interface**.
The project focuses on processing datasets, generating visual insights, and presenting them through an interactive dashboard.

---

## 🚀 Features

* Data upload and preprocessing
* Python-based data analysis and visualization logic
* Interactive dashboard for viewing charts and insights
* User authentication and basic access flow
* Modular separation between data logic and web interface

---

## 🛠️ Tech Stack

### Backend & Data Layer

* **Python**
* Pandas
* Plotly / visualization libraries
* Streamlit configuration (for visualization support)

### Web Layer

* **JavaScript (Node.js)**
* Express.js
* EJS (templating)
* HTML, CSS

### Database

* PostgreSQL (via `app_postgres.py`, optional integration)

### Tools

* Git & GitHub
* Virtual Environment (Python)
* npm (Node.js dependencies)

---

## 📂 Project Structure

```
DataVisualizerPro/
├── app.py
├── app_postgres.py
├── app.js
├── middleware/
├── models/
├── utils/
│   ├── data_analyzer.py
│   ├── file_handler.py
│   ├── chart_generator.py
│   └── data_analyzer.js
├── views/
│   ├── dashboard.ejs
│   ├── login.ejs
│   └── register.ejs
├── public/
│   ├── css/
│   └── js/
├── requirements.txt
├── package.json
├── .gitignore
└── README.md
```

---

## ⚙️ Getting Started

### Prerequisites

* Python 3.x
* Node.js & npm
* PostgreSQL (optional, for DB integration)

---

### Setup (Python)

```bash
python -m venv venv
venv\Scripts\activate   # Windows
pip install -r requirements.txt
```

### Setup (Node.js)

```bash
npm install
```

---

### Run the Application

**Python service**

```bash
python app.py
```

**Node.js server**

```bash
node app.js
```

---

## 🎯 Purpose of the Project

This project was built to:

* Practice **data analysis and visualization using Python**
* Learn **integration between Python logic and web applications**
* Understand **full web application flow (frontend ↔ backend ↔ data)**
* Build a structured, modular application suitable for real-world scenarios

---

## 📌 Current Status

The project is under active development, with ongoing improvements in:

* Data handling and error management
* Visualization accuracy
* Backend–frontend integration

---

## 👤 Author

**Rohan**
GitHub: [https://github.com/R0han5B](https://github.com/R0han5B)
