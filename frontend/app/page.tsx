"use client";

import Link from "next/link";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

export default function Home() {
  const features = [
    {
      title: "Upload Your Documents",
      description:
        "Upload your CV, diplomas, and references. We extract and organize everything automatically.",
      icon: "📄",
    },
    {
      title: "Add Job Offers",
      description:
        "Paste a job URL and we'll analyze the requirements to match with your skills.",
      icon: "🔍",
    },
    {
      title: "Track Applications",
      description:
        "Keep track of all your applications in one place. Export reports for unemployment offices (RAV).",
      icon: "📊",
    },
  ];

  const languages = [
    "English", "Deutsch", "Français", "Español", "Português", "Italiano",
    "Albanian", "Croatian", "Serbian", "Arabic", "Turkish", "Chinese",
    "Vietnamese", "Thai", "Filipino", "Hindi", "And 20+ more..."
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">
              EB
            </div>
            <span className="text-xl font-bold">EasyBewerbung</span>
          </div>
          <div className="flex gap-3">
            <Button href="/login" variant="outline">
              Log In
            </Button>
            <Button href="/register" variant="primary">
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <h1 className="text-5xl font-bold leading-tight">
            Job Applications Made{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
              Simple
            </span>
          </h1>
          <p className="text-xl text-slate-300">
            Upload your CV, add job offers, and track your applications.
            Perfect for cleaning, factory, logistics, and hospitality workers.
          </p>
          <p className="text-lg text-emerald-400">
            Available in 33+ languages
          </p>
          <div className="flex gap-4 justify-center pt-4">
            <Button href="/register" variant="primary">
              Start Free →
            </Button>
            <Button href="#features" variant="outline">
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">
          How It Works
        </h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {features.map((feature, index) => (
            <Card key={index}>
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-slate-400">{feature.description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Languages Section */}
      <section className="container mx-auto px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">
            Your Language, Your Success
          </h2>
          <Card>
            <p className="text-slate-300 text-center mb-6">
              Use the platform in your language, then create documents in the hiring company's language.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {languages.map((lang, index) => (
                <span
                  key={index}
                  className="px-3 py-1 rounded-full bg-slate-700 text-sm text-slate-200"
                >
                  {lang}
                </span>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* Swiss RAV Section */}
      <section className="container mx-auto px-6 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <Card className="bg-emerald-900/20 border-emerald-700">
            <h2 className="text-2xl font-bold mb-4 text-emerald-400">
              🇨🇭 Swiss RAV Compatible
            </h2>
            <p className="text-slate-300">
              Automatically generate job search reports (Nachweis der persönlichen Arbeitsbemühungen)
              for Swiss unemployment offices in the required format.
            </p>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <h2 className="text-4xl font-bold">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-slate-300">
            Create your free account and start managing your job applications today.
          </p>
          <Button href="/register" variant="primary" className="text-lg">
            Create Free Account →
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8">
        <div className="container mx-auto px-6 text-center text-slate-400">
          <p>© 2025 EasyBewerbung. Helping workers find their next opportunity.</p>
        </div>
      </footer>
    </div>
  );
}
