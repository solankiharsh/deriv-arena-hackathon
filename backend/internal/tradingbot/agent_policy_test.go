package tradingbot

import "testing"

func TestValidateAgentPolicy(t *testing.T) {
	t.Parallel()
	p := &BotAgentPolicy{}
	if err := validateAgentPolicy(p); err != nil {
		t.Fatal(err)
	}
	bad := &BotAgentPolicy{Identity: AgentPolicyIdentity{Personality: "nope"}}
	if err := validateAgentPolicy(bad); err == nil {
		t.Fatal("expected error")
	}
}
