import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { api, type PairDetail } from './api'
import { CodeCompare } from './components/CodeCompare'

const mockDetail = (overrides: Partial<PairDetail> = {}): PairDetail => ({
  summary: {
    id: 1,
    state: 'NEEDS_REVIEW',
    score: 0.78,
    fingerprintDice: 0.75,
    astStructuralScore: 0.80,
    matchedTokens: 150,
    distinctiveTokens: 150,
    longestTile: 40,
    a: { submissionId: 101, studentId: 11, studentName: 'Alice Student', attempt: 1 },
    b: { submissionId: 102, studentId: 12, studentName: 'Bob Student', attempt: 1 },
    latestReview: null,
  },
  weightedDice: 0.70,
  coverageA: 0.78,
  coverageB: 0.78,
  suppressedA: 0,
  suppressedB: 0,
  rarityActive: true,
  explanation: ['78% distinctive token overlap'],
  fragments: [
    {
      fileA: 'main.py',
      startLineA: 2,
      endLineA: 3,
      fileB: 'main.py',
      startLineB: 2,
      endLineB: 3,
      tokenCount: 20,
      rarityWeight: 0.8,
      distinctive: true,
    },
  ],
  structuralFragments: [
    {
      fileA: 'main.py',
      startLineA: 2,
      endLineA: 3,
      fileB: 'main.py',
      startLineB: 2,
      endLineB: 3,
      nodeType: 'function_definition',
      nodeCount: 15,
    },
  ],
  filesA: [{ id: 1001, path: 'main.py' }],
  filesB: [{ id: 2001, path: 'main.py' }],
  reviews: [],
  disclaimer: 'Similarity is an investigation signal, not a finding.',
  ...overrides,
})

describe('CodeCompare component', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders student A and student B submissions in their respective panes', async () => {
    const textSpy = vi.spyOn(api, 'text').mockImplementation(async (path: string) => {
      if (path === '/api/submissions/101/files/1001') {
        return 'def alice_code():\n    return "alice"\n    # unique end A\n'
      }
      if (path === '/api/submissions/102/files/2001') {
        return 'def bob_code():\n    return "bob"\n    # unique end B\n'
      }
      throw new Error('Unexpected path: ' + path)
    })

    const detail = mockDetail()
    render(<CodeCompare detail={detail} />)

    // Panes must have titles corresponding to the respective students
    expect(screen.getByRole('region', { name: 'Alice Student' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Bob Student' })).toBeInTheDocument()

    // Both files must load their respective content
    await waitFor(() => {
      expect(screen.getByText('def alice_code():')).toBeInTheDocument()
      expect(screen.getByText('def bob_code():')).toBeInTheDocument()
    })

    // Verify unmatched lines are distinguishable
    expect(screen.getByText('# unique end A')).toBeInTheDocument()
    expect(screen.getByText('# unique end B')).toBeInTheDocument()

    // Ensure API was called with the exact submission IDs
    expect(textSpy).toHaveBeenCalledWith('/api/submissions/101/files/1001')
    expect(textSpy).toHaveBeenCalledWith('/api/submissions/102/files/2001')
  })

  it('handles submissions with different file structures and filenames', async () => {
    vi.spyOn(api, 'text').mockImplementation(async (path: string) => {
      if (path === '/api/submissions/101/files/1001') {
        return 'print("from solution.py")'
      }
      if (path === '/api/submissions/102/files/2001') {
        return 'print("from algo.py")'
      }
      throw new Error('Unexpected path: ' + path)
    })

    const detail = mockDetail({
      fragments: [
        {
          fileA: 'solution.py',
          startLineA: 1,
          endLineA: 1,
          fileB: 'algo.py',
          startLineB: 1,
          endLineB: 1,
          tokenCount: 10,
          rarityWeight: 0.9,
          distinctive: true,
        },
      ],
      filesA: [{ id: 1001, path: 'solution.py' }],
      filesB: [{ id: 2001, path: 'algo.py' }],
    })

    render(<CodeCompare detail={detail} />)

    await waitFor(() => {
      expect(screen.getByText('print("from solution.py")')).toBeInTheDocument()
      expect(screen.getByText('print("from algo.py")')).toBeInTheDocument()
    })
  })

  it('updates both panes when detail changes to a new comparison pair', async () => {
    vi.spyOn(api, 'text').mockImplementation(async (path: string) => {
      if (path === '/api/submissions/101/files/1001') return 'pair 1 alice'
      if (path === '/api/submissions/102/files/2001') return 'pair 1 bob'
      if (path === '/api/submissions/301/files/3001') return 'pair 2 charlie'
      if (path === '/api/submissions/302/files/4001') return 'pair 2 dave'
      throw new Error('Unexpected path: ' + path)
    })

    const detail1 = mockDetail()
    const { rerender } = render(<CodeCompare detail={detail1} />)

    await waitFor(() => {
      expect(screen.getByText('pair 1 alice')).toBeInTheDocument()
      expect(screen.getByText('pair 1 bob')).toBeInTheDocument()
    })

    // Switch to pair 2
    const detail2 = mockDetail({
      summary: {
        id: 2,
        state: 'HIGH_PRIORITY_REVIEW',
        score: 0.95,
        fingerprintDice: 0.92,
        matchedTokens: 200,
        distinctiveTokens: 200,
        longestTile: 50,
        a: { submissionId: 301, studentId: 13, studentName: 'Charlie Student', attempt: 1 },
        b: { submissionId: 302, studentId: 14, studentName: 'Dave Student', attempt: 1 },
        latestReview: null,
      },
      filesA: [{ id: 3001, path: 'main.py' }],
      filesB: [{ id: 4001, path: 'main.py' }],
    })

    rerender(<CodeCompare detail={detail2} />)

    await waitFor(() => {
      expect(screen.getByText('pair 2 charlie')).toBeInTheDocument()
      expect(screen.getByText('pair 2 dave')).toBeInTheDocument()
    })

    // Previous text must no longer be present
    expect(screen.queryByText('pair 1 alice')).toBeNull()
    expect(screen.queryByText('pair 1 bob')).toBeNull()
  })

  it('correctly renders 100% identical submissions', async () => {
    const identicalCode = 'def identical():\n    return 42\n'
    vi.spyOn(api, 'text').mockResolvedValue(identicalCode)

    const detail = mockDetail({
      summary: {
        id: 3,
        state: 'NEEDS_REVIEW',
        score: 1.0,
        fingerprintDice: 1.0,
        matchedTokens: 50,
        distinctiveTokens: 50,
        longestTile: 50,
        a: { submissionId: 501, studentId: 15, studentName: 'Student 1', attempt: 1 },
        b: { submissionId: 502, studentId: 16, studentName: 'Student 2', attempt: 1 },
        latestReview: null,
      },
    })

    render(<CodeCompare detail={detail} />)

    await waitFor(() => {
      const elements = screen.getAllByText('def identical():')
      // Exactly 2 occurrences: one on side A, one on side B
      expect(elements).toHaveLength(2)
    })
  })

  it('correctly handles low similarity or no match edge cases', async () => {
    vi.spyOn(api, 'text').mockImplementation(async (path: string) => {
      if (path === '/api/submissions/101/files/1001') return 'code with no matches A'
      if (path === '/api/submissions/102/files/2001') return 'completely different code B'
      throw new Error('Unexpected path: ' + path)
    })

    const detail = mockDetail({
      summary: {
        id: 4,
        state: 'LOW_SIMILARITY',
        score: 0.0,
        fingerprintDice: 0.0,
        matchedTokens: 0,
        distinctiveTokens: 0,
        longestTile: 0,
        a: { submissionId: 101, studentId: 11, studentName: 'Alice Student', attempt: 1 },
        b: { submissionId: 102, studentId: 12, studentName: 'Bob Student', attempt: 1 },
        latestReview: null,
      },
      fragments: [],
      structuralFragments: [],
    })

    render(<CodeCompare detail={detail} />)

    await waitFor(() => {
      expect(screen.getByText('code with no matches A')).toBeInTheDocument()
      expect(screen.getByText('completely different code B')).toBeInTheDocument()
    })
  })

  it('allows toggling between Lexical and AST modes and clicking fragments to navigate', async () => {
    vi.spyOn(api, 'text').mockResolvedValue('line 1\nline 2\nline 3\nline 4\n')

    const detail = mockDetail()
    render(<CodeCompare detail={detail} />)

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Lexical Tokens' })).toHaveClass('on')
    })

    // Click on AST tab
    await userEvent.click(screen.getByRole('tab', { name: 'AST Structural Nodes' }))
    expect(screen.getByRole('tab', { name: 'AST Structural Nodes' })).toHaveClass('on')
    expect(screen.getByText('function_definition')).toBeInTheDocument()
  })
})
