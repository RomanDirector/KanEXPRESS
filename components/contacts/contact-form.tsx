'use client'

import { useState } from 'react'

export function ContactForm() {
  const [sent, setSent] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', role: '', message: '' })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // TODO: send to Supabase or email service
    setSent(true)
  }

  if (sent) {
    return (
      <div className="flex h-full min-h-64 flex-col items-center justify-center rounded-2xl border border-primary/20 bg-primary/5 p-10 text-center">
        <div className="mb-4 inline-flex rounded-full bg-primary/10 p-4 text-primary">
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-white">Сообщение отправлено!</h3>
        <p className="mt-2 text-sm text-white/40">Мы ответим вам в течение часа.</p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-white/5 bg-white/3 p-6 space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/40">
            Имя
          </label>
          <input
            name="name"
            type="text"
            required
            placeholder="Ваше имя"
            value={form.name}
            onChange={handleChange}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition-all focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/40">
            Email
          </label>
          <input
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            value={form.email}
            onChange={handleChange}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition-all focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/40">
          Вы являетесь
        </label>
        <select
          name="role"
          value={form.role}
          onChange={handleChange}
          className="w-full rounded-xl border border-white/10 bg-dark px-4 py-3 text-sm text-white outline-none transition-all focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
        >
          <option value="" disabled>Выберите роль...</option>
          <option value="seller">Продавец на Kaspi</option>
          <option value="courier">Курьер</option>
          <option value="warehouse">Склад / партнёр</option>
          <option value="other">Другое</option>
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/40">
          Сообщение
        </label>
        <textarea
          name="message"
          required
          rows={4}
          placeholder="Опишите ваш вопрос или задачу..."
          value={form.message}
          onChange={handleChange}
          className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition-all focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <button
        type="submit"
        className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-white transition-all hover:bg-primary/90 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-dark"
      >
        Отправить сообщение
      </button>
    </form>
  )
}
