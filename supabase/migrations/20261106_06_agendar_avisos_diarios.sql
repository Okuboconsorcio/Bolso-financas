-- Aplicada em 2026-11-06 no projeto Supabase Data-NTO (dkwtidhcuvrdzfcewfoz).
-- Todo dia às 9h (Brasília = 12h UTC) chama a função avisos para mandar os vencimentos.
-- Para mudar o horário: select cron.alter_job((select jobid from cron.job where jobname = 'bolso-avisos-vencimento'), schedule := '0 11 * * *');
select cron.schedule(
  'bolso-avisos-vencimento',
  '0 12 * * *',
  $job$
  select net.http_post(
    url := 'https://dkwtidhcuvrdzfcewfoz.supabase.co/functions/v1/avisos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'avisos_cron_secret')
    ),
    body := '{"acao":"enviar"}'::jsonb,
    timeout_milliseconds := 60000
  );
  $job$
);
