import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "react-email";

export interface BookingEmailShellProps {
  preview: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}

/** Versioned visual foundation only; Phase 5.1 does not dispatch it. */
export function BookingEmailShell({
  preview,
  eyebrow,
  title,
  children,
}: BookingEmailShellProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.wordmark}>
            <Text style={styles.brand}>
              MANILA <span style={styles.brandAccent}>AUTO PROS</span>
            </Text>
          </Section>
          <Section style={styles.panel}>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <Heading as="h1" style={styles.heading}>
              {title}
            </Heading>
            <Hr style={styles.rule} />
            {children}
          </Section>
          <Text style={styles.footer}>
            Transactional booking notice · Appointment times use Asia/Manila.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: {
    backgroundColor: "#090909",
    color: "#ffffff",
    fontFamily: "Arial, Helvetica, sans-serif",
    margin: "0",
    padding: "32px 12px",
  },
  container: {
    margin: "0 auto",
    maxWidth: "600px",
  },
  wordmark: {
    backgroundColor: "#090909",
    padding: "0 4px 18px",
  },
  brand: {
    color: "#ffffff",
    fontSize: "22px",
    fontWeight: "800",
    letterSpacing: "1.2px",
    margin: "0",
  },
  brandAccent: {
    color: "#E11D2E",
  },
  panel: {
    backgroundColor: "#141414",
    border: "1px solid #292929",
    padding: "32px",
  },
  eyebrow: {
    color: "#E11D2E",
    fontSize: "12px",
    fontWeight: "700",
    letterSpacing: "1.4px",
    margin: "0 0 10px",
    textTransform: "uppercase" as const,
  },
  heading: {
    color: "#ffffff",
    fontSize: "30px",
    lineHeight: "1.15",
    margin: "0",
  },
  rule: {
    borderColor: "#292929",
    margin: "24px 0",
  },
  footer: {
    color: "#A3A3A3",
    fontSize: "11px",
    lineHeight: "1.5",
    margin: "18px 4px 0",
    textAlign: "center" as const,
  },
} as const;
