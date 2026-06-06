'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100 rounded-full blur-[100px] opacity-50 z-0" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-100 rounded-full blur-[100px] opacity-50 z-0" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="z-10 flex flex-col items-center text-center max-w-3xl px-6"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mb-6 px-4 py-1.5 rounded-full bg-white border shadow-sm text-sm font-medium text-muted-foreground"
        >
          Welcome to the future of procurement
        </motion.div>
        
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground mb-6">
          Vendor<span className="text-gray-400">Bridge</span>
        </h1>
        
        <p className="text-xl text-muted-foreground mb-10 max-w-2xl">
          Streamline your RFQ process, connect with the best vendors, and manage your supply chain with our elegant and powerful platform.
        </p>

        <div className="flex items-center gap-4">
          <Link href="/login">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-3 rounded-lg bg-primary text-primary-foreground font-medium shadow-lg hover:bg-primary/90 transition-colors"
            >
              Get Started
            </motion.button>
          </Link>
          <Link href="/signup">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-3 rounded-lg bg-white text-primary border shadow-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Create Account
            </motion.button>
          </Link>
        </div>
      </motion.div>
    </main>
  );
}
