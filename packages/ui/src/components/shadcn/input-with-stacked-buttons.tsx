'use client'

import type { ReactNode } from 'react'
import { MinusIcon, PlusIcon } from 'lucide-react'
import { Button, Group, Input, Label, NumberField } from 'react-aria-components'

interface InputWithStackedButtonsProps {
  label?: ReactNode
  value?: number
  defaultValue?: number
  onChange?: (value: number) => void
  minValue?: number
  maxValue?: number
  step?: number
  className?: string
  inputClassName?: string
  showCredit?: boolean
}

export function InputWithStackedButtons({
  label,
  value,
  defaultValue,
  onChange,
  minValue,
  maxValue,
  step,
  className,
  inputClassName,
  showCredit = false,
}: InputWithStackedButtonsProps) {
  return (
    <NumberField
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      minValue={minValue}
      maxValue={maxValue}
      step={step}
      className={className ?? 'w-full space-y-2'}
    >
      {label && (
        <Label className='flex items-center gap-2 text-sm leading-none font-medium select-none'>
          {label}
        </Label>
      )}
      <Group className='dark:bg-input/30 border-input data-focus-within:border-ring data-focus-within:ring-ring/50 data-focus-within:has-aria-invalid:ring-destructive/20 dark:data-focus-within:has-aria-invalid:ring-destructive/40 data-focus-within:has-aria-invalid:border-destructive relative inline-flex h-8 w-full min-w-0 items-center overflow-hidden rounded-md border bg-transparent text-base whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-focus-within:ring-[3px] md:text-sm'>
        <Input className={`selection:bg-primary selection:text-primary-foreground w-full grow px-3 py-2 text-center tabular-nums outline-none ${inputClassName ?? ''}`} />
        <div className='flex h-[calc(100%+2px)] flex-col'>
          <Button
            slot='increment'
            className='border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground -me-px flex h-1/2 w-6 flex-1 items-center justify-center border text-sm transition-[color,box-shadow] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50'
          >
            <PlusIcon className='size-3' />
            <span className='sr-only'>Increment</span>
          </Button>
          <Button
            slot='decrement'
            className='border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground -me-px -mt-px flex h-1/2 w-6 flex-1 items-center justify-center border text-sm transition-[color,box-shadow] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50'
          >
            <MinusIcon className='size-3' />
            <span className='sr-only'>Decrement</span>
          </Button>
        </div>
      </Group>
      {showCredit && (
        <p className='text-muted-foreground text-xs'>
          Built with{' '}
          <a
            className='hover:text-foreground underline'
            href='https://react-spectrum.adobe.com/react-aria/NumberField.html'
            target='_blank'
            rel='noopener noreferrer'
          >
            React Aria
          </a>
        </p>
      )}
    </NumberField>
  )
}
