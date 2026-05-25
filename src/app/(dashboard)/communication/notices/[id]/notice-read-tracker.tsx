'use client'

import { useEffect } from 'react'
import { recordNoticeReadAction } from '@/app/(dashboard)/communication/actions'

export function NoticeReadTracker({ noticeId }: { noticeId: string }) {
  useEffect(() => {
    recordNoticeReadAction(noticeId)
  }, [noticeId])
  return null
}
