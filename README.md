<div align="center">

# 🖨️ PrintFlow - Student Portal

<a href="https://readme-typing-svg.herokuapp.com">
  <img src="https://readme-typing-svg.herokuapp.com/?lines=PrintFlow+-+Student+Portal;State-driven+job+ticketing;On-campus+commercial+printing&font=Inter&center=true&width=550&height=50&color=3B82F6&vCenter=true&size=22" alt="Typing SVG" />
</a>

<p align="center">
  <img src="https://img.shields.io/badge/Frontend-React-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Styling-Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Build-Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
</p>

---

<img src="demo.gif" width="600" alt="UI Demo GIF Placeholder" style="border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"/>

</div>

<br />

## 📖 Context
PrintFlow is a state-driven job ticketing and procurement ledger for on-campus commercial printing at CIT-U. This repository houses the client-facing React application where students upload assets, view auto-generated pricing, and pay seamlessly via PayMongo.

---

## ✨ Features

| Feature | Description |
| :---: | :--- |
| 🤖 **Agentic AI Asset Validation** | Automatically analyzes uploaded documents for specifications and compliance before checkout. |
| ⚡ **Real-time Spooler Updates** | Leverages WebSockets to give students live updates as their documents are printed. |
| 💳 **Automated Checkout** | Fully integrated with PayMongo for secure, instant payment processing. |

---

## 🚀 Local Setup

To get the student portal running locally:

```bash
# 1. Clone the repository and navigate inside
cd printflow-frontend

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

**Environment Variables:**
Ensure you have a `.env` file in the root directory pointing to the backend API:
```env
VITE_API_URL=http://localhost:3000
```

---

## 👥 Contributors
Proudly developed by the PrintFlow team:
- **Jude Mikael Valencia**
- **Karol Vincent Bebedor**
- **Noeh Arbee Boiser**
- **Aldrin Suse**
