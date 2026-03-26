import type {
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class MandateZApi implements ICredentialType {
  name = 'mandateZApi';
  displayName = 'MandateZ API';
  documentationUrl = 'https://mandatez.mintlify.app';

  properties: INodeProperties[] = [
    {
      displayName: 'Supabase URL',
      name: 'supabase_url',
      type: 'string',
      default: '',
      required: true,
      placeholder: 'https://xxxx.supabase.co',
      description: 'Your Supabase project URL',
    },
    {
      displayName: 'Supabase Anon Key',
      name: 'supabase_anon_key',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description: 'Your Supabase anonymous/public key',
    },
    {
      displayName: 'MandateZ Owner ID',
      name: 'mandatez_owner_id',
      type: 'string',
      default: '',
      required: true,
      placeholder: 'user_xxxx',
      description:
        'Your MandateZ owner ID — find it at core-consumer.vercel.app/account',
    },
  ];
}
