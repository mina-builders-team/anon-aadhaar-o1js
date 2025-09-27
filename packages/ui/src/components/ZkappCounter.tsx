'use client';
import { useEffect, useState } from 'react';
import { CounterZkapp, MINA_ARCHIVE_ENDPOINT, MINA_NODE_ENDPOINT } from 'anon-aadhaar-o1js';
import { fetchAccount, Field, Mina, PublicKey } from 'o1js';

interface ZkAppCounterDisplayProps {
  zkAppPublicKey: string;
}

export default function ZkAppCounterDisplay({ zkAppPublicKey }: ZkAppCounterDisplayProps) {
  const [counterValue, setCounterValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCounterValue = async () => {
    setLoading(true);
    setError(null);

    try {
      const zkAppAddress = PublicKey.fromBase58(zkAppPublicKey);
      const zkAppInstance = new CounterZkapp(zkAppAddress);
      const network = Mina.Network({
        mina: MINA_NODE_ENDPOINT,
        archive: MINA_ARCHIVE_ENDPOINT,
      });
      Mina.setActiveInstance(network);

      const res = await fetchAccount({ publicKey: zkAppAddress });
      if (!res.account) {
        setError('zkApp account not found on chain');
        return;
      }

      const value: Field = await zkAppInstance.counter.get();
      setCounterValue(Field.toValue(value).toString());
    } catch (err) {
      console.error('Failed to fetch counter value:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch counter value');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (zkAppPublicKey) fetchCounterValue();
  }, [zkAppPublicKey]);

  return (
    <div className="relative p-5 rounded-lg bg-gray-800/60 border border-gray-700 shadow-md w-full mx-auto">

  <button
    onClick={fetchCounterValue}
    disabled={loading}
    className="absolute top-3 right-3 px-2 py-0.5 text-xs bg-blue-600 rounded hover:bg-blue-500 disabled:opacity-50 transition-colors"
  >
    {loading ? 'Fetching...' : 'Refresh'}
  </button>

  <h3 className="text-lg font-semibold text-white text-center mb-4">zkApp Counter</h3>

  <div className="flex flex-col items-center space-y-2">
    <p className="text-sm text-gray-400 font-medium">Current Counter</p>

    {loading && (
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-gray-300">Fetching counter value...</span>
      </div>
    )}

    {error && (
      <p className="text-red-400 text-sm">
        <span className="font-medium">Error:</span> {error}
      </p>
    )}

    {!loading && !error && counterValue !== null && (
      <p className="text-2xl font-bold text-green-400">{counterValue}</p>
    )}

    {!loading && !error && counterValue === null && (
      <p className="text-gray-400">No counter value available</p>
    )}
  </div>
</div>

  );
}