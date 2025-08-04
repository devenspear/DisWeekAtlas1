import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Alternative database setup using Prisma db push
export async function POST(req: NextRequest) {
  try {
    console.log('🔄 Setting up database schema with Prisma...')
    
    // Run prisma db push to create all tables
    const { stdout, stderr } = await execAsync('npx prisma db push --force-reset')
    
    console.log('Prisma output:', stdout)
    if (stderr) console.log('Prisma stderr:', stderr)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database schema created successfully with Prisma',
      output: stdout
    })
    
  } catch (error) {
    console.error('Database setup error:', error)
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Database schema creation failed'
    }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({ 
    message: 'Use POST to set up database schema with Prisma db push'
  })
}