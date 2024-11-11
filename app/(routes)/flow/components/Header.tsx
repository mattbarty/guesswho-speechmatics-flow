'use client';

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useAudioDevices } from '@speechmatics/browser-audio-input-react';

interface HeaderProps {
  personas: Record<string, { name: string; }>;
  setDeviceId: (deviceId: string) => void;
  setPersonaId: (personaId: string) => void;
  defaultDeviceId?: string;
  defaultPersonaId?: string;
}

export function Header({
  personas,
  setDeviceId,
  setPersonaId,
  defaultDeviceId,
  defaultPersonaId
}: HeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const devices = useAudioDevices();

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && devices.permissionState === 'prompt') {
      devices.promptPermissions();
    }
  };

  return (
    <header className="flex justify-between items-center w-full p-4 border-b">
      <h1 className="text-xl font-bold">Conversation</h1>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Microphone</Label>
              <MicrophoneSelect
                setDeviceId={setDeviceId}
                defaultDeviceId={defaultDeviceId}
                devices={devices}
              />
            </div>
            <div className="space-y-2">
              <Label>Persona</Label>
              <Select onValueChange={setPersonaId} defaultValue={Object.keys(personas)[0]}>
                <SelectTrigger>
                  <SelectValue placeholder="Select persona" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(personas).map(([id, { name }]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}

function MicrophoneSelect({
  setDeviceId,
  defaultDeviceId,
  devices
}: {
  setDeviceId: (deviceId: string) => void;
  defaultDeviceId?: string;
  devices: ReturnType<typeof useAudioDevices>;
}) {
  switch (devices.permissionState) {
    case 'prompt':
      return (
        <Select disabled onValueChange={() => { }}>
          <SelectTrigger onClick={devices.promptPermissions}>
            <SelectValue placeholder="Enable mic permissions" />
          </SelectTrigger>
        </Select>
      );
    case 'prompting':
      return (
        <Select disabled onValueChange={() => { }}>
          <SelectTrigger>
            <SelectValue placeholder="Enabling permissions..." />
          </SelectTrigger>
        </Select>
      );
    case 'granted':
      // Check if we have any devices
      if (!devices.deviceList.length) {
        return (
          <Select disabled onValueChange={() => { }}>
            <SelectTrigger>
              <SelectValue placeholder="No microphones found" />
            </SelectTrigger>
          </Select>
        );
      }

      // If no default is set, use the first device
      const effectiveDefaultDevice = defaultDeviceId || devices.deviceList[0]?.deviceId;

      return (
        <Select
          onValueChange={setDeviceId}
          defaultValue={effectiveDefaultDevice}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select microphone" />
          </SelectTrigger>
          <SelectContent>
            {devices.deviceList.map((d) => (
              <SelectItem key={d.deviceId} value={d.deviceId}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case 'denied':
      return (
        <Select disabled onValueChange={() => { }}>
          <SelectTrigger>
            <SelectValue placeholder="Microphone permission denied" />
          </SelectTrigger>
        </Select>
      );
    default:
      return null;
  }
} 