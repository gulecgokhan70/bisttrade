'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FadeIn } from '@/components/ui/animate'
import { Newspaper, Clock, TrendingUp, BarChart3, Layers, Info, ChevronDown, ChevronUp, Rocket } from 'lucide-react'

interface NewsItem {
  id: string
  title: string
  summary: string
  source: string
  url: string
  publishedAt: string
  category: string
}

const categoryConfig: Record<string, { icon: any; color: string }> = {
  'Piyasa': { icon: TrendingUp, color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  'Sektör': { icon: Layers, color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  'Hacim': { icon: BarChart3, color: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20' },
  'Genel': { icon: Newspaper, color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  'Bilgi': { icon: Info, color: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/20' },
  'Halka Arz': { icon: Rocket, color: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20' },
}

export function NewsFeed() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    fetchNews()
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchNews, 5 * 60_000)
    return () => clearInterval(interval)
  }, [])

  const fetchNews = async () => {
    try {
      const res = await fetch('/api/news')
      if (res.ok) {
        const data = await res.json()
        setNews(data?.news ?? [])
        setLastUpdated(new Date())
      }
    } catch {}
    setLoading(false)
  }

  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffMin = Math.floor(diffMs / 60000)
      if (diffMin < 1) return 'Az önce'
      if (diffMin < 60) return `${diffMin} dk önce`
      const diffHours = Math.floor(diffMin / 60)
      if (diffHours < 24) return `${diffHours} saat önce`
      return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
    } catch {
      return ''
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 w-3/4 bg-muted rounded mb-2" />
                <div className="h-3 w-full bg-muted rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <FadeIn delay={0.35}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
              <Newspaper className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base font-semibold">Haber Akışı</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                BİST piyasa haberleri ve analizler
                {lastUpdated && (
                  <span className="ml-1.5 text-[10px]">
                    · Son güncelleme: {lastUpdated.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })}
                    <span className="ml-1 text-emerald-500">●</span>
                  </span>
                )}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {news.length === 0 ? (
            <div className="text-center py-8">
              <Newspaper className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Şu anda haber bulunmamaktadır
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {news.map((item) => {
                const catConfig = categoryConfig[item.category] ?? categoryConfig['Genel']
                const CatIcon = catConfig.icon
                const isExpanded = expandedId === item.id

                return (
                  <div
                    key={item.id}
                    className={`group rounded-xl border transition-all cursor-pointer ${
                      isExpanded
                        ? 'border-primary/30 bg-muted/40 shadow-sm'
                        : 'border-border/50 bg-muted/20 hover:bg-muted/40 hover:border-border'
                    }`}
                    onClick={() => toggleExpand(item.id)}
                  >
                    {/* Collapsed header - always visible */}
                    <div className="flex items-start gap-3 p-4">
                      <div className="shrink-0 mt-0.5">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${catConfig.color.split(' ')[0]}`}>
                          <CatIcon className={`h-4 w-4 ${catConfig.color.split(' ').slice(1, 3).join(' ')}`} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 font-semibold border ${catConfig.color}`}>
                            {item.category}
                          </Badge>
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Clock className="h-2.5 w-2.5" />
                            {formatTime(item.publishedAt)}
                          </span>
                        </div>
                        <h4 className={`text-sm font-semibold leading-snug transition-colors ${
                          isExpanded ? 'text-primary' : 'group-hover:text-primary'
                        }`}>
                          {item.title}
                        </h4>
                        {!isExpanded && (
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-1 mt-1">
                            {item.summary}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 mt-1">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-0 ml-11">
                        <div className="border-t border-border/40 pt-3">
                          <p className="text-sm text-foreground/80 leading-relaxed">
                            {item.summary}
                          </p>
                          <div className="flex items-center justify-between mt-3">
                            <p className="text-[11px] text-muted-foreground">{item.source}</p>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(item.publishedAt).toLocaleString('tr-TR', {
                                day: 'numeric',
                                month: 'long',
                                hour: '2-digit',
                                minute: '2-digit',
                                timeZone: 'Europe/Istanbul',
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </FadeIn>
  )
}
