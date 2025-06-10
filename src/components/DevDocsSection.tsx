import React from "react";

const HEROKU_APP = "your-heroku-app"; // Replace with your actual Heroku app name

export default function DevDocsSection() {
  return (
    <section className="max-w-2xl mx-auto my-8 p-4 sm:p-6 bg-gray-800/90 rounded-xl shadow-lg border border-gray-700 text-center">
      <h2 className="text-2xl font-bold mb-3 text-purple-400">Developer API Docs</h2>
      <p className="mb-4 text-gray-200 text-lg">
        Want to explore or integrate with the GitStats backend API?<br />
        <span className="font-semibold text-purple-300">The backend is hosted on Heroku.</span>
      </p>
      <a
        href={`${process.env.NEXT_PUBLIC_BACKEND_URL}/swagger-ui/index.html`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg shadow hover:bg-purple-700 transition-colors text-lg mb-3"
      >
        Visit the API Docs (Swagger UI)
      </a>
      <p className="text-gray-400 mt-3 text-sm">
        All API endpoints, authentication details, and live testing are available in the Swagger UI.
      </p>
    </section>
  );
} 