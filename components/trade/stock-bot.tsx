'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Bot, Sparkles, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

type Timeframe = 'daily' | 'weekly' | 'monthly'

const timeframeLabels: Record<Timeframe, string> = {
  daily: 'Günlük',
  weekly: 'Haftalık',
  monthly: 'Aylık',
}

interface StockBotProps {
  symbol: string
  stockName: string
}

export function StockBot({ symbol, stockName }: StockBotProps) {
  const [analysis, setAnalysis] = useState('')
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [hasAnalyzed, setHasAnalyzed] = useState(false)
  const [timeframe, setTimeframe] = useState<Timeframe>('daily')
  const contentRef = useRef<HTMLDivElement>(null)
  const prevSymbolRef = useRef(symbol)

  // Reset when symbol changes
  useEffect(() => {
    if (prevSymbolRef.current !== symbol) {
      setAnalysis('')
      setHasAnalyzed(false)
      setExpanded(false)
      prevSymbolRef.current = symbol
    }
  }, [symbol])

  const runAnalysis = async (tf?: Timeframe) => {
    const selectedTf = tf ?? timeframe
    setLoading(true)
    setAnalysis('')
    setExpanded(true)
    setHasAnalyzed(true)

    try {
      const response = await fetch('/api/stock-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, timeframe: selectedTf }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        setAnalysis(`⚠️ ${err?.error || 'Analiz yapılamadı. Lütfen tekrar deneyin.'}`)
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        setAnalysis('⚠️ Bağlantı hatası')
        return
      }

      const decoder = new TextDecoder()
      let partialRead = ''
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        partialRead += decoder.decode(value, { stream: true })
        const lines = partialRead.split('\n')
        partialRead = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') break
            try {
              const parsed = JSON.parse(data)
              if (parsed.content) {
                fullText += parsed.content
                setAnalysis(fullText)
              }
            } catch (e) {
              // skip
            }
          }
        }
      }
    } catch (error) {
      console.error('Bot error:', error)
      setAnalysis('⚠️ Bağlantı hatası. Lütfen tekrar deneyin.')
    } finally {
      setLoading(false)
    }
  }

  // Simple markdown renderer
  const renderMarkdown = (text: string) => {
    return text.split('\n').map((line: string, i: number) => {
      // Headers
      if (line.startsWith('### ')) return <h4 key={i} className="font-bold text-sm mt-3 mb-1">{line.slice(4)}</h4>
      if (line.startsWith('## ')) return <h3 key={i} className="font-bold text-base mt-3 mb-1">{line.slice(3)}</h3>
      // Bold text
      const boldProcessed = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // List items
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return (
          <div key={i} className="flex gap-1.5 text-xs leading-relaxed ml-2">
            <span className="text-primary shrink-0 mt-0.5">•</span>
            <span dangerouslySetInnerHTML={{ __html: boldProcessed.slice(2) }} />
          </div>
        )
      }
      if (line.trim() === '') return <div key={i} className="h-1.5" />
      return <p key={i} className="text-xs leading-relaxed" dangerouslySetInnerHTML={{ __html: boldProcessed }} />
    })
  }

  return (
    <Card className="overflow-hidden border-primary/20">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">AI Hisse Analisti</CardTitle>
              <p className="text-[10px] text-muted-foreground">Destek/direnç, teknik göstergeler</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {hasAnalyzed && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
            )}
            <Button
              size="sm"
              variant={hasAnalyzed ? 'ghost' : 'default'}
              className={cn('gap-1.5 text-xs h-7', !hasAnalyzed && 'bg-primary text-primary-foreground')}
              onClick={() => runAnalysis()}
              disabled={loading}
            >
              {loading ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Analiz ediliyor...
                </>
              ) : hasAnalyzed ? (
                <>
                  <RefreshCw className="h-3 w-3" />
                  Yenile
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3" />
                  {symbol} Analiz Et
                </>
              )}
            </Button>
          </div>
        </div>
        {/* Timeframe Selector */}
        <div className="flex items-center gap-1.5 mt-3">
          {(Object.entries(timeframeLabels) as [Timeframe, string][]).map(([key, label]) => (
            <Button
              key={key}
              size="sm"
              variant={timeframe === key ? 'default' : 'outline'}
              className={cn(
                'text-[11px] h-6 px-2.5 rounded-full',
                timeframe === key && 'bg-primary text-primary-foreground'
              )}
              disabled={loading}
              onClick={() => {
                setTimeframe(key)
                if (hasAnalyzed) runAnalysis(key)
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="px-4 pb-4 pt-2">
          <div
            ref={contentRef}
            className={cn(
              'rounded-lg bg-muted/50 p-3 max-h-[400px] overflow-y-auto',
              loading && 'animate-pulse'
            )}
          >
            {analysis ? (
              <div className="space-y-0.5">
                {renderMarkdown(analysis)}
                {loading && (
                  <span className="inline-block w-2 h-4 bg-primary/60 animate-pulse rounded-sm ml-0.5" />
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
                <Sparkles className="h-4 w-4 animate-pulse" />
                <span>Analiz hazırlanıyor...</span>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
