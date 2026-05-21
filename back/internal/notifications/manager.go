package notifications

import (
	"fmt"
	"time"
)

type Manager struct {
	service *Service
}

func NewManager(service *Service) *Manager {
	return &Manager{service: service}
}

func (m *Manager) Send(accountID int64, message string) (*Notification, error) {
	return m.service.Create(accountID, message, time.Time{})
}

func (m *Manager) Notify(accountID int64, message string) error {
	_, err := m.Send(accountID, message)
	return err
}

func (m *Manager) ReservationCreated(accountID, reservationID, queueID int64) (*Notification, error) {
	return m.Send(accountID, fmt.Sprintf("Reservation #%d was created for queue #%d.", reservationID, queueID))
}

func (m *Manager) ReservationUpdated(accountID, reservationID int64, status string) (*Notification, error) {
	return m.Send(accountID, fmt.Sprintf("Reservation #%d was updated to %s.", reservationID, status))
}

func (m *Manager) QueueUpdated(accountID, queueID int64, label string) (*Notification, error) {
	if label != "" {
		return m.Send(accountID, fmt.Sprintf("Queue #%d was updated: %s.", queueID, label))
	}
	return m.Send(accountID, fmt.Sprintf("Queue #%d was updated.", queueID))
}

func (m *Manager) DoctorAvailabilityChanged(accountID int64, availability string) (*Notification, error) {
	return m.Send(accountID, fmt.Sprintf("Your doctor availability is now %s.", availability))
}

func (m *Manager) ProfileUpdated(accountID int64) (*Notification, error) {
	return m.Send(accountID, "Your profile was updated successfully.")
}

func (m *Manager) SecurityAlert(accountID int64, action string) (*Notification, error) {
	return m.Send(accountID, fmt.Sprintf("Security alert: %s.", action))
}
