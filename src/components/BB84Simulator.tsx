import React, { useState, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from "recharts";
import { 
  Play, 
  RotateCcw, 
  Shield, 
  Zap, 
  Key, 
  AlertTriangle,
  Eye,
  CheckCircle,
  XCircle
} from "lucide-react";

// BB84 Protocol Implementation
interface BB84Result {
  nQubits: number;
  eveProbability: number;
  siftedKeyLength: number;
  qberSifted: number;
  qberFinal?: number;
  finalKeyLength?: number;
  ecQueries?: number;
  secure: boolean;
}

interface ProtocolStep {
  name: string;
  description: string;
  completed: boolean;
  data?: any;
}

class BB84Protocol {
  private seed: number;
  
  constructor(seed?: number) {
    this.seed = seed || Math.floor(Math.random() * 1000000);
  }
  
  private random(): number {
    // Simple PRNG for reproducibility
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
  
  generateBitsAndBases(n: number): { bits: number[], bases: number[] } {
    const bits = Array.from({ length: n }, () => Math.floor(this.random() * 2));
    const bases = Array.from({ length: n }, () => Math.floor(this.random() * 2));
    return { bits, bases };
  }
  
  simulateQuantumChannel(
    aliceBits: number[], 
    aliceBases: number[], 
    bobBases: number[], 
    eveProb: number,
    noiseProb: number = 0.01
  ): number[] {
    const results: number[] = [];
    
    for (let i = 0; i < aliceBits.length; i++) {
      let bit = aliceBits[i];
      const aliceBase = aliceBases[i];
      const bobBase = bobBases[i];
      
      // Eve's intercept-resend attack
      if (this.random() < eveProb) {
        // Eve measures in random basis
        const eveBase = Math.floor(this.random() * 2);
        if (eveBase !== aliceBase) {
          // Wrong basis - 50% chance of error
          if (this.random() < 0.5) {
            bit = 1 - bit;
          }
        }
      }
      
      // Quantum channel noise
      if (this.random() < noiseProb) {
        bit = 1 - bit;
      }
      
      // Bob's measurement
      if (aliceBase !== bobBase) {
        // Different bases - random result
        bit = Math.floor(this.random() * 2);
      }
      
      results.push(bit);
    }
    
    return results;
  }
  
  siftKeys(
    aliceBits: number[], 
    aliceBases: number[], 
    bobBits: number[], 
    bobBases: number[]
  ): { aliceSifted: number[], bobSifted: number[] } {
    const aliceSifted: number[] = [];
    const bobSifted: number[] = [];
    
    for (let i = 0; i < aliceBits.length; i++) {
      if (aliceBases[i] === bobBases[i]) {
        aliceSifted.push(aliceBits[i]);
        bobSifted.push(bobBits[i]);
      }
    }
    
    return { aliceSifted, bobSifted };
  }
  
  calculateQBER(key1: number[], key2: number[]): number {
    if (key1.length === 0) return 1.0;
    const errors = key1.reduce((acc, bit, i) => acc + (bit !== key2[i] ? 1 : 0), 0);
    return errors / key1.length;
  }
  
  errorCorrection(
    aliceKey: number[], 
    bobKey: number[], 
    blockSize: number = 16
  ): { aliceCorrected: number[], bobCorrected: number[], queries: number } {
    const alice = [...aliceKey];
    const bob = [...bobKey];
    let queries = 0;
    
    // Simplified CASCADE-like protocol
    const blocks = Math.ceil(alice.length / blockSize);
    
    for (let block = 0; block < blocks; block++) {
      const start = block * blockSize;
      const end = Math.min(start + blockSize, alice.length);
      
      const aliceBlock = alice.slice(start, end);
      const bobBlock = bob.slice(start, end);
      
      const aliceParity = aliceBlock.reduce((acc, bit) => acc ^ bit, 0);
      const bobParity = bobBlock.reduce((acc, bit) => acc ^ bit, 0);
      
      queries++;
      
      if (aliceParity !== bobParity) {
        // Binary search for error (simplified)
        const errorPos = Math.floor(this.random() * (end - start));
        bob[start + errorPos] ^= 1;
        queries++;
      }
    }
    
    return { aliceCorrected: alice, bobCorrected: bob, queries };
  }
  
  privacyAmplification(key: number[], targetLength?: number): number[] {
    if (!targetLength) {
      targetLength = Math.max(32, Math.floor(key.length / 2));
    }
    
    // Simplified hash-based PA
    const hash = key.reduce((acc, bit, i) => acc ^ (bit << (i % 32)), 0);
    const result: number[] = [];
    
    for (let i = 0; i < targetLength; i++) {
      result.push((hash >> i) & 1);
    }
    
    return result;
  }
  
  runProtocol(
    nQubits: number,
    eveProb: number = 0.0,
    noise: boolean = false,
    errorCorrection: boolean = false,
    privacyAmplification: boolean = false
  ): BB84Result {
    // Step 1: Alice generates bits and bases
    const { bits: aliceBits, bases: aliceBases } = this.generateBitsAndBases(nQubits);
    
    // Step 2: Bob generates bases
    const { bases: bobBases } = this.generateBitsAndBases(nQubits);
    
    // Step 3: Quantum transmission with Eve and noise
    const noiseProb = noise ? 0.02 : 0.001; // Background noise
    const bobBits = this.simulateQuantumChannel(aliceBits, aliceBases, bobBases, eveProb, noiseProb);
    
    // Step 4: Key sifting
    const { aliceSifted, bobSifted } = this.siftKeys(aliceBits, aliceBases, bobBits, bobBases);
    
    // Calculate initial QBER
    const qberSifted = this.calculateQBER(aliceSifted, bobSifted);
    
    let finalAlice = aliceSifted;
    let finalBob = bobSifted;
    let qberFinal = qberSifted;
    let ecQueries = 0;
    
    // Step 5: Error correction
    if (errorCorrection && aliceSifted.length > 0) {
      const { aliceCorrected, bobCorrected, queries } = this.errorCorrection(aliceSifted, bobSifted);
      finalAlice = aliceCorrected;
      finalBob = bobCorrected;
      qberFinal = this.calculateQBER(finalAlice, finalBob);
      ecQueries = queries;
    }
    
    // Step 6: Privacy amplification
    let finalKeyLength = finalAlice.length;
    if (privacyAmplification && finalAlice.length > 0) {
      const amplifiedKey = this.privacyAmplification(finalAlice);
      finalKeyLength = amplifiedKey.length;
    }
    
    // Security assessment
    const secure = qberFinal <= 0.11; // Standard threshold
    
    return {
      nQubits,
      eveProbability: eveProb,
      siftedKeyLength: aliceSifted.length,
      qberSifted,
      qberFinal,
      finalKeyLength,
      ecQueries,
      secure
    };
  }
}

export const BB84Simulator: React.FC = () => {
  const [nQubits, setNQubits] = useState([100]);
  const [eveProb, setEveProb] = useState([0.0]);
  const [seed, setSeed] = useState("42");
  const [noise, setNoise] = useState(false);
  const [errorCorrection, setErrorCorrection] = useState(false);
  const [privacyAmplification, setPrivacyAmplification] = useState(false);
  
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<BB84Result | null>(null);
  const [qberHistory, setQberHistory] = useState<Array<{ qubits: number; qber: number; scenario: string }>>([]);
  const [protocolSteps, setProtocolSteps] = useState<ProtocolStep[]>([]);
  
  const { toast } = useToast();
  
  const runSimulation = useCallback(async () => {
    setIsRunning(true);
    setProtocolSteps([]);
    
    const steps: ProtocolStep[] = [
      { name: "Initialization", description: "Alice and Bob prepare their equipment", completed: false },
      { name: "Bit & Basis Generation", description: "Alice generates random bits and measurement bases", completed: false },
      { name: "Quantum Transmission", description: "Alice sends qubits through quantum channel", completed: false },
      { name: "Key Sifting", description: "Alice and Bob compare bases publicly", completed: false },
      { name: "Error Estimation", description: "Calculate quantum bit error rate (QBER)", completed: false },
    ];
    
    if (errorCorrection) {
      steps.push({ name: "Error Correction", description: "Remove errors using CASCADE protocol", completed: false });
    }
    
    if (privacyAmplification) {
      steps.push({ name: "Privacy Amplification", description: "Compress key to remove Eve's information", completed: false });
    }
    
    steps.push({ name: "Security Assessment", description: "Determine if key is secure", completed: false });
    
    // Animate through steps
    for (let i = 0; i < steps.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 300));
      setProtocolSteps(prev => {
        const updated = [...prev];
        updated[i] = { ...steps[i], completed: true };
        return updated;
      });
    }
    
    try {
      const protocol = new BB84Protocol(parseInt(seed) || undefined);
      const result = protocol.runProtocol(
        nQubits[0],
        eveProb[0],
        noise,
        errorCorrection,
        privacyAmplification
      );
      
      setResults(result);
      
      // Update QBER history
      const scenario = eveProb[0] > 0 ? "With Eavesdropping" : "Ideal Channel";
      setQberHistory(prev => [
        ...prev.filter(item => !(item.qubits === result.nQubits && item.scenario === scenario)),
        { qubits: result.nQubits, qber: result.qberSifted, scenario }
      ].slice(-20)); // Keep last 20 points
      
      toast({
        title: result.secure ? "Secure Key Generated! 🔐" : "Security Compromised! ⚠️",
        description: `QBER: ${(result.qberFinal! * 100).toFixed(2)}% | Key Length: ${result.finalKeyLength}`,
        variant: result.secure ? "default" : "destructive"
      });
      
    } catch (error) {
      toast({
        title: "Simulation Error",
        description: "Failed to run BB84 protocol simulation",
        variant: "destructive"
      });
    } finally {
      setIsRunning(false);
    }
  }, [nQubits, eveProb, seed, noise, errorCorrection, privacyAmplification, toast]);
  
  const resetSimulation = useCallback(() => {
    setResults(null);
    setProtocolSteps([]);
    setQberHistory([]);
  }, []);
  
  const keyReductionData = useMemo(() => {
    if (!results) return [];
    
    return [
      { stage: "Raw Bits", length: results.nQubits, color: "#60a5fa" },
      { stage: "Sifted Key", length: results.siftedKeyLength, color: "#34d399" },
      { stage: "Final Key", length: results.finalKeyLength || results.siftedKeyLength, color: "#a78bfa" }
    ];
  }, [results]);
  
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-quantum bg-clip-text text-transparent">
            BB84 Quantum Key Distribution Simulator
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Experience the quantum cryptography protocol that enables unconditionally secure communication. 
            Simulate the effects of eavesdropping, noise, and post-processing techniques.
          </p>
        </div>
        
        {/* Controls */}
        <Card className="p-6 border-2 border-border/50 bg-gradient-to-br from-card via-card to-card/80">
          <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Simulation Parameters
          </h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Left Column */}
            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="text-base font-medium">Number of Qubits: {nQubits[0]}</Label>
                <Slider
                  value={nQubits}
                  onValueChange={setNQubits}
                  min={10}
                  max={500}
                  step={10}
                  className="w-full"
                />
                <p className="text-sm text-muted-foreground">
                  Higher qubit counts provide better statistics but take longer to process
                </p>
              </div>
              
              <div className="space-y-3">
                <Label className="text-base font-medium">
                  Eve's Attack Probability: {(eveProb[0] * 100).toFixed(1)}%
                </Label>
                <Slider
                  value={eveProb}
                  onValueChange={setEveProb}
                  min={0}
                  max={1}
                  step={0.01}
                  className="w-full"
                />
                <p className="text-sm text-muted-foreground">
                  Simulates intercept-resend eavesdropping attacks
                </p>
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="seed" className="text-base font-medium">Random Seed</Label>
                <Input
                  id="seed"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  placeholder="Enter seed for reproducibility"
                  className="w-full"
                />
              </div>
            </div>
            
            {/* Right Column */}
            <div className="space-y-6">
              <div className="space-y-4">
                <Label className="text-base font-medium">Protocol Options</Label>
                
                <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div className="space-y-1">
                    <p className="font-medium">Channel Noise</p>
                    <p className="text-sm text-muted-foreground">Add quantum decoherence effects</p>
                  </div>
                  <Switch checked={noise} onCheckedChange={setNoise} />
                </div>
                
                <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div className="space-y-1">
                    <p className="font-medium">Error Correction</p>
                    <p className="text-sm text-muted-foreground">CASCADE protocol implementation</p>
                  </div>
                  <Switch checked={errorCorrection} onCheckedChange={setErrorCorrection} />
                </div>
                
                <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div className="space-y-1">
                    <p className="font-medium">Privacy Amplification</p>
                    <p className="text-sm text-muted-foreground">Hash-based key compression</p>
                  </div>
                  <Switch checked={privacyAmplification} onCheckedChange={setPrivacyAmplification} />
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex gap-4 mt-8">
            <Button 
              onClick={runSimulation} 
              disabled={isRunning}
              size="lg"
              className="bg-gradient-quantum hover:shadow-glow"
            >
              {isRunning ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2"></div>
                  Running Protocol...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run BB84 Protocol
                </>
              )}
            </Button>
            
            <Button 
              onClick={resetSimulation}
              variant="outline"
              size="lg"
              disabled={isRunning}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>
        </Card>
        
        {/* Protocol Steps */}
        {protocolSteps.length > 0 && (
          <Card className="p-6">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              Protocol Execution
            </h3>
            
            <div className="space-y-3">
              {protocolSteps.map((step, index) => (
                <div key={index} className="flex items-center gap-3 p-3 rounded-lg border border-border/50">
                  <div className="flex-shrink-0">
                    {step.completed ? (
                      <CheckCircle className="h-5 w-5 text-primary" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-muted animate-pulse" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${step.completed ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {step.name}
                    </p>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                  {step.completed && (
                    <Badge variant="secondary" className="bg-primary/20 text-primary">
                      Complete
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
        
        {/* Results */}
        {results && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Metrics */}
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Shield className={`h-5 w-5 ${results.secure ? 'text-primary' : 'text-destructive'}`} />
                Security Metrics
              </h3>
              
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 border border-border rounded-lg">
                    <p className="text-2xl font-bold text-primary">{results.siftedKeyLength}</p>
                    <p className="text-sm text-muted-foreground">Sifted Key Bits</p>
                  </div>
                  
                  <div className="text-center p-4 border border-border rounded-lg">
                    <p className="text-2xl font-bold text-secondary">{results.finalKeyLength}</p>
                    <p className="text-sm text-muted-foreground">Final Key Bits</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Initial QBER</span>
                    <Badge variant={results.qberSifted > 0.11 ? "destructive" : "secondary"}>
                      {(results.qberSifted * 100).toFixed(2)}%
                    </Badge>
                  </div>
                  
                  <Progress value={results.qberSifted * 100} className="h-2" />
                  
                  {results.qberFinal !== undefined && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Final QBER</span>
                        <Badge variant={results.qberFinal > 0.11 ? "destructive" : "secondary"}>
                          {(results.qberFinal * 100).toFixed(2)}%
                        </Badge>
                      </div>
                      <Progress value={results.qberFinal * 100} className="h-2" />
                    </>
                  )}
                </div>
                
                <div className={`p-4 rounded-lg border-2 ${
                  results.secure 
                    ? 'border-primary/50 bg-primary/10' 
                    : 'border-destructive/50 bg-destructive/10'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {results.secure ? (
                      <Shield className="h-5 w-5 text-primary" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                    )}
                    <p className="font-semibold">
                      {results.secure ? "Secure Key Generated" : "Security Compromised"}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {results.secure 
                      ? "QBER below 11% threshold - key is secure against eavesdropping"
                      : "QBER above 11% threshold - potential eavesdropping detected"
                    }
                  </p>
                </div>
              </div>
            </Card>
            
            {/* Key Reduction Chart */}
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">Key Length Progression</h3>
              
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={keyReductionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="stage" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar 
                    dataKey="length" 
                    fill="hsl(var(--primary))"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}
        
        {/* QBER History Chart */}
        {qberHistory.length > 0 && (
          <Card className="p-6">
            <h3 className="text-xl font-semibold mb-4">QBER Analysis</h3>
            
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={qberHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="qubits" 
                  stroke="hsl(var(--muted-foreground))"
                  label={{ value: 'Number of Qubits', position: 'insideBottom', offset: -5 }}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  label={{ value: 'QBER', angle: -90, position: 'insideLeft' }}
                  domain={[0, 0.5]}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number) => [`${(value * 100).toFixed(2)}%`, 'QBER']}
                />
                <Line 
                  type="monotone" 
                  dataKey="qber" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={3}
                  dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: 'hsl(var(--primary))', strokeWidth: 2, fill: 'hsl(var(--background))' }}
                />
                {/* Security threshold line */}
                <Line 
                  type="monotone" 
                  dataKey={() => 0.11}
                  stroke="hsl(var(--destructive))" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  name="Security Threshold"
                />
              </LineChart>
            </ResponsiveContainer>
            
            <p className="text-sm text-muted-foreground mt-4 text-center">
              The red dashed line shows the 11% QBER threshold above which eavesdropping is detected
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};